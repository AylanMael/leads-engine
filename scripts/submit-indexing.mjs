#!/usr/bin/env node
// Node.js 22+. Voir scripts/INDEXING.md. Importer ce module n'effectue aucun appel.
import { readFile, writeFile, mkdir, rename, open, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const INDEXNOW = "https://api.indexnow.org/indexnow";
const COOLDOWN = 600_000;

export function validateUrls(input, vertical) {
  if (!["demenagement", "renovation"].includes(vertical)) throw new Error("Vertical invalide.");
  if (!Array.isArray(input) || !input.length || input.length > 50_000) {
    throw new Error("Fournir un tableau JSON de 1 à 50 000 URLs absolues.");
  }
  let origin;
  const urls = input.map((value) => {
    if (typeof value !== "string") throw new Error("Chaque URL doit être une chaîne.");
    const url = new URL(value);
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.hash || url.search ||
        !url.hostname.includes(".") || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname) ||
        /\.(localhost|local|internal)$/.test(url.hostname) ||
        !new RegExp(`^/${vertical}/[a-z0-9]+(?:-[a-z0-9]+)*/?$`).test(url.pathname)) {
      throw new Error(`URL locale canonique HTTPS attendue pour ${vertical} : ${value}`);
    }
    origin ??= url.origin;
    if (origin !== url.origin) throw new Error("Une seule origine est autorisée par exécution.");
    return url.href;
  });
  return { urls: [...new Set(urls)], origin };
}

export function sitemapXml(urls) {
  const escape = (text) => text.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escape(url)}</loc></url>`).join("\n")}\n</urlset>\n`;
}

export function retryTime(header, now = Date.now()) {
  if (!header) return null;
  const milliseconds = /^\d+$/.test(header.trim()) ? now + Number(header) * 1000 : Date.parse(header);
  return Number.isFinite(milliseconds) ? Math.max(now, milliseconds) : null;
}

/** Un seul appel à la fois. 429 reporte le travail ; 5xx/réseau : deux reprises maximum. */
export function createRequester({ fetchImpl = fetch, wait = sleep, now = Date.now, interval = 2000 } = {}) {
  let lastStart = -Infinity;
  return async function request(url, options, onAttempt = async () => {}) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      await wait(Math.max(0, interval - (now() - lastStart)));
      lastStart = now();
      let result;
      try {
        const response = await fetchImpl(url, { ...options, redirect: "error", signal: AbortSignal.timeout(15_000) });
        // Lire dans le délai du fetch ; le contenu n'est jamais écrit dans le rapport.
        const body = await response.text();
        const retryAt = retryTime(response.headers.get("retry-after"), now());
        result = { httpStatus: response.status, body, retryAt, date: new Date(now()).toISOString(), attempt };
      } catch {
        result = { httpStatus: null, body: "", retryAt: null, date: new Date(now()).toISOString(), attempt };
      }
      if (result.httpStatus === 429) result.retryAt = Math.max(result.retryAt ?? 0, now() + COOLDOWN);
      await onAttempt(result);
      const transient = result.httpStatus === null || result.httpStatus >= 500;
      if (!transient || attempt === 3 || (result.retryAt && result.retryAt - now() > 60_000)) return result;
      await wait(Math.max(1000 * 2 ** (attempt - 1), (result.retryAt ?? 0) - now()));
    }
  };
}

export function outcome(status) {
  if (status === 202) return "accepted_validation_pending";
  if (status >= 200 && status < 300) return "submitted";
  if (status === 429) return "rate_limited";
  return status === null ? "network_error" : "http_error";
}

export function eligibleUrls(urls, entries, provider, origin, now = Date.now()) {
  const relevant = entries.filter((entry) => entry.provider === provider && entry.origin === origin);
  if (relevant.some((entry) => entry.retryAt && Date.parse(entry.retryAt) > now)) return [];
  const recent = new Set(relevant.filter((entry) => entry.stage === "submission" &&
    ["submitted", "accepted_validation_pending"].includes(entry.outcome) &&
    now - Date.parse(entry.date) < COOLDOWN).map((entry) => entry.url));
  return urls.filter((url) => !recent.has(url));
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return fallback; throw error; }
}

async function googleToken() {
  // Bibliothèque officielle : compte de service JSON via GOOGLE_APPLICATION_CREDENTIALS,
  // ou identité de compte de service via ADC sur Google Cloud.
  const { GoogleAuth } = await import("google-auth-library");
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/webmasters"] });
  const client = await auth.getClient();
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Jeton Google absent.");
  return token;
}

export async function run({ file, vertical, prepare = false, google = false, root = ROOT,
  env = process.env, request = createRequester(), getToken = googleToken }) {
  const { urls, origin } = validateUrls(await readJson(resolve(file)), vertical);
  const lockPath = resolve(root, ".indexing.lock");
  const lock = await open(lockPath, "wx").catch(() => { throw new Error("Autre soumission active : .indexing.lock existe (à retirer après un arrêt brutal uniquement)."); });
  try {
    const reportPath = resolve(root, "indexing-report.json");
    const report = await readJson(reportPath, { version: 1, entries: [] });
    if (report.version !== 1 || !Array.isArray(report.entries)) throw new Error("Rapport existant invalide.");
    const save = async () => {
      await writeFile(`${reportPath}.tmp`, `${JSON.stringify(report, null, 2)}\n`);
      await rename(`${reportPath}.tmp`, reportPath);
    };
    const record = (provider, stage, batch) => async (result) => {
      report.entries.push(...batch.map((url) => ({ url, origin, vertical, provider, stage,
        date: result.date ?? new Date().toISOString(), httpStatus: result.httpStatus ?? null,
        outcome: result.outcome ?? outcome(result.httpStatus), attempt: result.attempt ?? 0,
        retryAt: result.retryAt ? new Date(result.retryAt).toISOString() : null })));
      await save();
    };
    const keyPath = resolve(root, ".indexnow-key.json");
    const keys = await readJson(keyPath, {});
    const key = env.INDEXNOW_KEY || keys[origin] || randomBytes(16).toString("hex");
    if (typeof key !== "string" || !/^[a-zA-Z0-9-]{8,128}$/.test(key)) throw new Error("Clé IndexNow invalide (8–128 caractères alphanumériques ou tirets).");
    keys[origin] = key;
    await writeFile(keyPath, `${JSON.stringify(keys, null, 2)}\n`);
    await mkdir(resolve(root, "public"), { recursive: true });
    await writeFile(resolve(root, "public", `${key}.txt`), key);
    const xml = sitemapXml(urls);
    const sitemapName = `sitemap-priority-${vertical}.xml`;
    await writeFile(resolve(root, "public", sitemapName), xml);
    if (prepare) {
      await record("local", "preparation", urls)({ outcome: "prepared", httpStatus: null });
      console.log(`Préparé : ${urls.length} URLs. Déployer public/${key}.txt et public/${sitemapName}, puis relancer sans --prepare.`);
      return { failed: false };
    }

    let failed = false;
    const keyLocation = `${origin}/${key}.txt`;
    const pending = eligibleUrls(urls, report.entries, "indexnow", origin);
    const skipped = urls.filter((url) => !pending.includes(url));
    if (skipped.length) await record("indexnow", "submission", skipped)({ outcome: "skipped_cooldown", httpStatus: null });
    if (pending.length) {
      const proof = await request(keyLocation, {}, record("indexnow", "key_check", pending));
      if (proof.httpStatus !== 200 || proof.body.trim() !== key) {
        await record("indexnow", "submission", pending)({ outcome: "blocked_key_not_deployed", httpStatus: null });
        failed = true;
      } else {
        for (let start = 0; start < pending.length; start += 10_000) {
          const batch = pending.slice(start, start + 10_000);
          const result = await request(INDEXNOW, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
            body: JSON.stringify({ host: new URL(origin).host, key, keyLocation, urlList: batch }) }, record("indexnow", "submission", batch));
          if (![200, 202].includes(result.httpStatus)) {
            failed = true;
            const remaining = pending.slice(start + 10_000);
            if (remaining.length) await record("indexnow", "submission", remaining)({ outcome: "not_sent_after_failure", httpStatus: null });
            break;
          }
        }
      }
    }

    if (!google) {
      await record("google", "submission", urls)({ outcome: "disabled_use_google_flag", httpStatus: null });
    } else {
      const pendingGoogle = eligibleUrls(urls, report.entries, "google", origin);
      if (!pendingGoogle.length) {
        await record("google", "submission", urls)({ outcome: "skipped_cooldown", httpStatus: null });
      } else {
        const sitemapUrl = `${origin}/${sitemapName}`;
        const check = await request(sitemapUrl, {}, record("google", "sitemap_check", urls));
        if (check.httpStatus !== 200 || check.body.trim() !== xml.trim()) {
          await record("google", "submission", urls)({ outcome: "blocked_sitemap_not_deployed", httpStatus: null });
          failed = true;
        } else {
          let token;
          try { token = await getToken(); }
          catch {
            await record("google", "authentication", urls)({ outcome: "authentication_error", httpStatus: null });
            failed = true;
          }
          if (token) {
            const property = env.GSC_SITE_URL || `${origin}/`;
            const hostname = new URL(origin).hostname;
            const domain = property.startsWith("sc-domain:") ? property.slice(10) : null;
            if (property !== `${origin}/` && !(domain && (hostname === domain || hostname.endsWith(`.${domain}`)))) {
              throw new Error("GSC_SITE_URL doit couvrir exactement l'origine ou son domaine parent.");
            }
            const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(property)}/sitemaps/${encodeURIComponent(sitemapUrl)}`;
            // Le statut HTTP concerne le sitemap entier, pas une indexation individuelle.
            const result = await request(endpoint, { method: "PUT", headers: { Authorization: `Bearer ${token}` } }, record("google", "submission", urls));
            if (result.httpStatus < 200 || result.httpStatus >= 300 || result.httpStatus === null) failed = true;
          }
        }
      }
    }
    console.log(`${urls.length} URLs traitées. Rapport : ${reportPath}. Soumission ≠ indexation.`);
    return { failed };
  } finally {
    await lock.close();
    await unlink(lockPath);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes("--help")) {
    console.log("Usage : node scripts/submit-indexing.mjs urls.json --vertical demenagement|renovation [--prepare] [--google]");
    return;
  }
  const file = args.shift();
  let vertical = process.env.NEXT_PUBLIC_VERTICAL || "demenagement";
  let prepare = false;
  let google = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === "--vertical") vertical = args.shift();
    else if (arg === "--prepare") prepare = true;
    else if (arg === "--google") google = true;
    else throw new Error(`Argument inconnu : ${arg}`);
  }
  const { failed } = await run({ file, vertical, prepare, google });
  if (failed) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`Indexation : ${error.message}`); process.exitCode = 1; });
}
