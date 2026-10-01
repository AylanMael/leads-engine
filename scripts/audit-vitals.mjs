#!/usr/bin/env node
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { randomInt } from "node:crypto";
import { createServer } from "node:net";
import { spawn, execFile } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
export const THROTTLING = { rttMs: 150, throughputKbps: 1638.4, cpuSlowdownMultiplier: 4,
  requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675 };

export function sitemapPaths(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((match) => {
    try { return new URL(match[1].replaceAll("&amp;", "&")).pathname; } catch { return ""; }
  }).filter((path) => /^\/(demenagement|renovation)\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path));
}

export function sampleRoutes(manifest, random = randomInt) {
  const groups = { demenagement: [], renovation: [] };
  for (const path of Object.keys(manifest.routes ?? {})) {
    const match = /^\/(demenagement|renovation)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(path);
    if (match) groups[match[1]].push({ path, vertical: match[1] });
  }
  const shuffle = (items) => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = random(i + 1);
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const selected = [];
  // Garantir les deux verticaux, puis compléter au hasard sans remplacement.
  const rest = [];
  for (const items of Object.values(groups)) {
    const shuffled = shuffle(items);
    if (shuffled.length) selected.push(shuffled.shift());
    rest.push(...shuffled);
  }
  selected.push(...shuffle(rest).slice(0, 5 - selected.length));
  const errors = [];
  if (selected.length < 5) errors.push(`Seulement ${selected.length} pages locales disponibles sur les 5 requises.`);
  for (const [vertical, items] of Object.entries(groups)) if (!items.length) errors.push(`Aucune page locale pour ${vertical}.`);
  return { selected: shuffle(selected), errors, available: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])) };
}

export function summarizeLighthouse(lhr) {
  const metric = (id) => {
    const value = lhr.audits?.[id]?.numericValue;
    return Number.isFinite(value) ? value : null;
  };
  const score = (id) => typeof lhr.categories?.[id]?.score === "number" ? lhr.categories[id].score * 100 : null;
  return { performance: score("performance"), seo: score("seo"),
    lcpMs: metric("largest-contentful-paint"), cls: metric("cumulative-layout-shift"),
    tbtMs: metric("total-blocking-time"), lighthouseVersion: lhr.lighthouseVersion };
}

export function gateFailures(results, coverageErrors = []) {
  const errors = [...coverageErrors];
  for (const result of results) {
    if (result.error) errors.push(`${result.path} : ${result.error}`);
    for (const category of ["performance", "seo"]) {
      if (!Number.isFinite(result[category]) || result[category] < 90) errors.push(`${result.path} : ${category} = ${result[category] ?? "indisponible"}, minimum 90.`);
    }
    for (const metric of ["lcpMs", "cls", "inpLabMs"]) if (!Number.isFinite(result[metric])) errors.push(`${result.path} : ${metric} non mesuré.`);
  }
  if (!results.length) errors.push("Aucune page auditée.");
  return errors;
}

function npmProcess(args, env) {
  // Seules des commandes internes fixes et un port numérique sont transmis au shell Windows.
  const cli = process.env.npm_execpath;
  const command = cli ? process.execPath : process.platform === "win32" ? "cmd.exe" : "npm";
  const argv = cli ? [cli, ...args] : process.platform === "win32" ? ["/d", "/s", "/c", `npm ${args.join(" ")}`] : args;
  const child = spawn(command, argv, { cwd: ROOT, env, stdio: "inherit", windowsHide: true, detached: process.platform !== "win32" });
  const done = new Promise((resolveDone, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolveDone() : reject(new Error(`npm ${args[1]} interrompu (${code ?? signal}).`)));
  });
  // Le serveur est long-vivant : éviter une rejection non observée pendant les audits.
  done.catch(() => {});
  return { child, done };
}

async function stopProcess(handle) {
  if (!handle?.child.pid || handle.child.exitCode !== null || handle.child.signalCode !== null) return;
  if (process.platform === "win32") {
    await new Promise((resolveStop) => execFile("taskkill", ["/PID", String(handle.child.pid), "/T", "/F"], { windowsHide: true }, () => resolveStop()));
  } else {
    try { process.kill(-handle.child.pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
  }
}

async function freePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolveListen); });
  const port = server.address().port;
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function waitForServer(port, handle) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (handle.child.exitCode !== null || handle.child.signalCode !== null) throw new Error("Le serveur de production s’est arrêté.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(2000) });
      if (response.ok) return;
    } catch { /* serveur encore en démarrage */ }
    await sleep(500);
  }
  throw new Error("Le serveur n’est pas prêt après 90 secondes.");
}

/** Session distincte de Lighthouse : INP synthétique, jamais présenté comme CrUX/RUM. */
async function measureInp(browser, url, source) {
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 412, height: 823, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true });
    await page.setUserAgent("Mozilla/5.0 (Linux; Android 11; Moto G Power) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36");
    const cdp = await page.createCDPSession();
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150,
      downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8, connectionType: "cellular4g" });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await page.setCacheEnabled(false);
    // Aucune soumission de formulaire ni écriture Firebase pendant le scénario.
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const action = ["GET", "HEAD", "OPTIONS"].includes(request.method()) ? request.continue() : request.abort();
      action.catch(() => {});
    });
    await page.evaluateOnNewDocument(`${source}\nwindow.__auditINP = null; webVitals.onINP(m => { window.__auditINP = m.value; }, {reportAllChanges: true, durationThreshold: 16});`);
    const response = await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    if (response?.status() !== 200 || page.url() !== url) throw new Error("Page INP absente ou redirigée.");
    const interactions = [];
    const summary = await page.$("details > summary");
    if (summary) {
      await summary.click(); await sleep(300); await summary.click();
      interactions.push("ouvrir puis fermer une réponse de FAQ");
    }
    const field = await page.$('form input[type="text"]:not([readonly]):not([disabled])');
    if (field) {
      await field.click(); await field.type("Audit", { delay: 80 });
      interactions.push("cliquer et saisir dans un champ texte, sans envoyer le formulaire");
    }
    if (!interactions.length) throw new Error("Aucune interaction compatible : adapter le scénario INP à cette page.");
    await page.waitForFunction(() => Number.isFinite(window.__auditINP), { timeout: 10_000 });
    await sleep(1000);
    return { inpLabMs: await page.evaluate(() => window.__auditINP), interactions };
  } finally { await page.close(); }
}

export async function auditVitals({ reuseBuild = false } = {}) {
  const output = resolve(ROOT, "reports", "vitals", new Date().toISOString().replace(/[:.]/g, "-"));
  await mkdir(output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), threshold: 90, mode: "mobile-slow-4g",
    inpSource: "web-vitals — scénario synthétique local, pas un INP terrain au 75e percentile",
    throttling: THROTTLING, available: {}, results: [], failures: [], passed: false, buildReused: reuseBuild };
  let build, server, chrome, browser;
  const cleanup = async () => {
    if (browser) { browser.disconnect(); browser = undefined; }
    const launchedChrome = chrome;
    chrome = undefined;
    // chrome-launcher peut renvoyer void depuis kill(). Toujours arrêter aussi
    // le serveur, même si le nettoyage du profil Chromium échoue.
    const stopped = await Promise.allSettled([
      Promise.resolve().then(() => launchedChrome?.kill()), stopProcess(server), stopProcess(build),
    ]);
    const failed = stopped.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  };
  const interrupt = () => { void cleanup().finally(() => process.exit(1)); };
  process.once("SIGINT", interrupt);
  process.once("SIGTERM", interrupt);
  try {
    const env = { ...process.env, NEXT_AUDIT_BUILD: "1", NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "production" };
    if (!reuseBuild) {
      console.log("Construction de production isolée (.next-audit)…");
      build = npmProcess(["run", "build"], env);
      await build.done;
    } else console.log("Diagnostic sur le build .next-audit existant (ne valide pas un déploiement).");
    const manifest = JSON.parse(await readFile(resolve(ROOT, ".next-audit/prerender-manifest.json"), "utf8"));
    const port = await freePort();
    server = npmProcess(["run", "start", "--", "--hostname", "127.0.0.1", "--port", String(port)], env);
    await waitForServer(port, server);
    const sitemap = await fetch(`http://127.0.0.1:${port}/sitemap.xml`, { signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (!sitemap.ok) throw new Error("Sitemap local indisponible.");
    // Les en-têtes de marque rendent certaines pages dynamiques malgré staticParams.
    // Compléter le manifeste par le sitemap réellement servi par le build.
    const generatedPaths = new Set([...Object.keys(manifest.routes ?? {}), ...sitemapPaths(await sitemap.text())]);
    const sample = sampleRoutes({ routes: Object.fromEntries([...generatedPaths].map((path) => [path, {}])) });
    if (reuseBuild) sample.errors.push("Build réutilisé : diagnostic uniquement, relancer sans --reuse-build pour valider un déploiement.");
    report.available = sample.available;
    report.prerenderedLocalPaths = Object.keys(manifest.routes ?? {}).filter((path) => /^\/(demenagement|renovation)\//.test(path));
    report.failures.push(...sample.errors);
    for (const error of sample.errors) console.error(error);
    if (!sample.selected.length) throw new Error("Aucune route locale générée à analyser.");
    const [{ default: lighthouse }, launcher, { default: puppeteer }] = await Promise.all([
      import("lighthouse"), import("chrome-launcher"), import("puppeteer-core"),
    ]);
    chrome = await launcher.launch({ chromePath: process.env.CHROME_PATH || undefined,
      chromeFlags: ["--headless", "--no-first-run", "--no-default-browser-check", "--host-resolver-rules=MAP *.localhost 127.0.0.1"] });
    const source = await readFile(join(dirname(require.resolve("web-vitals")), "web-vitals.iife.js"), "utf8");
    for (const route of sample.selected) {
      const url = `http://${route.vertical}.localhost:${port}${route.path}`;
      const result = { ...route, url, inpLabMs: null };
      console.log(`Audit mobile : ${route.path}`);
      try {
        const run = await lighthouse(url, { port: chrome.port, output: ["json", "html"], logLevel: "error",
          onlyCategories: ["performance", "seo"], formFactor: "mobile", throttlingMethod: "simulate", throttling: THROTTLING,
          maxWaitForLoad: 45_000, maxWaitForFcp: 30_000 });
        if (!run?.lhr) throw new Error("Lighthouse n’a pas retourné de rapport.");
        const name = route.path.slice(1).replaceAll("/", "-");
        await writeFile(resolve(output, `${name}.json`), JSON.stringify(run.lhr, null, 2));
        await writeFile(resolve(output, `${name}.html`), run.report[1]);
        if (run.lhr.runtimeError) throw new Error(`Lighthouse : ${run.lhr.runtimeError.code}`);
        if ((run.lhr.finalDisplayedUrl ?? run.lhr.finalUrl) !== url) throw new Error("Redirection inattendue : la page auditée n’est pas la commune demandée.");
        if (run.lhr.audits["http-status-code"]?.score !== 1) throw new Error("La page locale ne répond pas correctement (HTTP).");
        Object.assign(result, summarizeLighthouse(run.lhr));
        browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
        try { Object.assign(result, await measureInp(browser, url, source)); }
        finally { browser.disconnect(); browser = undefined; }
        console.log(`  Performance ${result.performance}/100 · SEO ${result.seo}/100 · LCP ${Math.round(result.lcpMs)} ms · CLS ${result.cls} · INP simulé ${result.inpLabMs} ms`);
      } catch (error) { result.error = error.message; console.error(`${route.path} : ${error.message}`); }
      report.results.push(result);
      await writeFile(resolve(output, "audit-vitals.json"), JSON.stringify(report, null, 2));
    }
    report.failures = gateFailures(report.results, sample.errors);
    report.passed = report.failures.length === 0;
  } catch (error) {
    report.failures.push(error.message);
  } finally {
    try { await cleanup(); } catch (error) { report.failures.push(`Nettoyage : ${error.message}`); report.passed = false; }
    report.finishedAt = new Date().toISOString();
    await writeFile(resolve(output, "audit-vitals.json"), `${JSON.stringify(report, null, 2)}\n`);
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
  console.log(`Rapport : ${output}`);
  for (const failure of report.failures) console.error(failure);
  return report.passed;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== "--reuse-build")) throw new Error("Seule l’option diagnostique --reuse-build est acceptée.");
  auditVitals({ reuseBuild: args.includes("--reuse-build") }).then((passed) => { if (!passed) process.exitCode = 1; })
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
