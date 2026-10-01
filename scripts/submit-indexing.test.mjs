import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { validateUrls, sitemapXml, createRequester, eligibleUrls, retryTime, run } from "./submit-indexing.mjs";

const url = "https://demenagement-local.fr/demenagement/versailles-78000";
const key = "1234567890abcdef";
async function fixture(t, urls = [url]) {
  const root = await mkdtemp(resolve(tmpdir(), "indexing-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = resolve(root, "urls.json");
  await writeFile(file, JSON.stringify(urls));
  return { root, file, vertical: "demenagement", env: { INDEXNOW_KEY: key } };
}

test("validation : déduplication, origine et vertical uniques", () => {
  assert.deepEqual(validateUrls([url, url], "demenagement").urls, [url]);
  for (const urls of [[url.replace("https:", "http:")], [url.replace("demenagement/", "renovation/")], [url, url.replace(".fr", ".com")], [url + "?tracking=1"], [url + "#fragment"], [url.replace("demenagement-local.fr", "localhost")]]) {
    assert.throws(() => validateUrls(urls, "demenagement"));
  }
  assert.match(sitemapXml([url]), /<loc>https:\/\/demenagement-local.fr/);
});

test("429 : pas de reprise immédiate ; Retry-After conservé", async () => {
  let calls = 0;
  const attempts = [];
  const request = createRequester({ now: () => 1000, wait: async () => {}, fetchImpl: async () => {
    calls++; return new Response("", { status: 429, headers: { "Retry-After": "900" } });
  } });
  const result = await request(url, {}, async (item) => attempts.push(item));
  assert.equal(calls, 1);
  assert.equal(result.retryAt, 901000);
  assert.equal(attempts[0].httpStatus, 429);
  assert.equal(retryTime("Thu, 01 Jan 1970 00:01:00 GMT", 0), 60_000);
});

test("5xx : reprises bornées, temporisation et journal de chaque tentative", async () => {
  let clock = 0;
  let calls = 0;
  const attempts = [];
  const request = createRequester({ now: () => clock, wait: async (ms) => { clock += ms; }, fetchImpl: async () => {
    calls++; return new Response("", { status: calls < 3 ? 503 : 200 });
  } });
  assert.equal((await request(url, {}, async (item) => attempts.push(item))).httpStatus, 200);
  assert.deepEqual(attempts.map((item) => item.httpStatus), [503, 503, 200]);
  assert.ok(clock >= 4000);
});

test("cooldown persistant : URL acceptée et quotas du fournisseur", () => {
  const origin = new URL(url).origin;
  const entry = { url, origin, provider: "indexnow", stage: "submission", outcome: "submitted", date: new Date(0).toISOString() };
  assert.deepEqual(eligibleUrls([url], [entry], "indexnow", origin, 1000), []);
  assert.deepEqual(eligibleUrls([url], [entry], "google", origin, 1000), [url]);
  assert.deepEqual(eligibleUrls([url], [entry], "indexnow", origin, 600001), [url]);
  assert.deepEqual(eligibleUrls([url], [{ ...entry, outcome: "rate_limited", retryAt: new Date(900000).toISOString() }], "indexnow", origin, 800000), []);
});

test("préparation : clé et sitemap, aucun réseau, clé réutilisée", async (t) => {
  const args = await fixture(t);
  const request = async () => { throw new Error("Réseau interdit"); };
  await run({ ...args, prepare: true, request });
  await run({ ...args, env: {}, prepare: true, request });
  assert.equal(await readFile(resolve(args.root, "public", `${key}.txt`), "utf8"), key);
  assert.equal(await readFile(resolve(args.root, "public", "sitemap-priority-demenagement.xml"), "utf8"), sitemapXml([url]));
});

test("preuve non déployée : aucune soumission IndexNow", async (t) => {
  const args = await fixture(t);
  let calls = 0;
  const result = await run({ ...args, request: async (_url, _options, log) => {
    calls++;
    const response = { httpStatus: 404, body: "Not found" };
    await log(response); return response;
  } });
  assert.equal(result.failed, true);
  assert.equal(calls, 1);
  const report = JSON.parse(await readFile(resolve(args.root, "indexing-report.json")));
  assert.ok(report.entries.some((entry) => entry.outcome === "blocked_key_not_deployed" && entry.httpStatus === null));
});

test("IndexNow 202 et Search Console PUT : payload, auth et rapport sans jeton", async (t) => {
  const args = await fixture(t);
  const calls = [];
  const result = await run({ ...args, google: true, getToken: async () => "sensitive-token", request: async (endpoint, options, log) => {
    calls.push({ endpoint, options });
    const response = { httpStatus: 200, body: key };
    if (endpoint.endsWith(".xml")) response.body = sitemapXml([url]);
    if (endpoint === "https://api.indexnow.org/indexnow") {
      response.httpStatus = 202;
      assert.deepEqual(JSON.parse(options.body), { host: "demenagement-local.fr", key, keyLocation: `https://demenagement-local.fr/${key}.txt`, urlList: [url] });
    }
    if (options.method === "PUT") {
      response.httpStatus = 204;
      assert.equal(options.headers.Authorization, "Bearer sensitive-token");
      assert.match(endpoint, /www.googleapis.com\/webmasters\/v3\/sites\//);
    }
    await log(response); return response;
  } });
  assert.equal(result.failed, false);
  assert.equal(calls.length, 4);
  const raw = await readFile(resolve(args.root, "indexing-report.json"), "utf8");
  assert.ok(!raw.includes("sensitive-token"));
  assert.ok(JSON.parse(raw).entries.some((entry) => entry.outcome === "accepted_validation_pending"));
});

test("lots IndexNow de 10 000 maximum", async (t) => {
  const urls = Array.from({ length: 10001 }, (_, i) => `https://demenagement-local.fr/demenagement/ville-${i}`);
  const args = await fixture(t, urls);
  const sizes = [];
  await run({ ...args, request: async (_endpoint, options, log) => {
    if (options.method === "POST") sizes.push(JSON.parse(options.body).urlList.length);
    const response = { httpStatus: 200, body: key };
    await log(response); return response;
  } });
  assert.deepEqual(sizes, [10000, 1]);
});

test("429 en batch : arrêt des lots suivants et report persistant", async (t) => {
  const urls = Array.from({ length: 10001 }, (_, i) => `https://demenagement-local.fr/demenagement/ville-${i}`);
  const args = await fixture(t, urls);
  let posts = 0;
  const request = async (_endpoint, options, log) => {
    const response = options.method === "POST"
      ? { httpStatus: 429, body: "", retryAt: Date.now() + 900000 }
      : { httpStatus: 200, body: key };
    if (options.method === "POST") posts++;
    await log(response); return response;
  };
  assert.equal((await run({ ...args, request })).failed, true);
  assert.equal(posts, 1);
  await run({ ...args, request: async () => { throw new Error("Le quota doit bloquer tout appel"); } });
  const report = JSON.parse(await readFile(resolve(args.root, "indexing-report.json")));
  assert.ok(report.entries.some((entry) => entry.url === urls.at(-1) && entry.outcome === "not_sent_after_failure"));
});

test("échec Google Auth : journalisé sans perdre la soumission IndexNow", async (t) => {
  const args = await fixture(t);
  const result = await run({ ...args, google: true, getToken: async () => { throw new Error("secret-non-journalisable"); }, request: async (endpoint, _options, log) => {
    const response = { httpStatus: 200, body: endpoint.endsWith(".xml") ? sitemapXml([url]) : key };
    await log(response); return response;
  } });
  assert.equal(result.failed, true);
  const raw = await readFile(resolve(args.root, "indexing-report.json"), "utf8");
  assert.ok(!raw.includes("secret-non-journalisable"));
  assert.ok(JSON.parse(raw).entries.some((entry) => entry.outcome === "authentication_error"));
  assert.ok(JSON.parse(raw).entries.some((entry) => entry.provider === "indexnow" && entry.stage === "submission" && entry.outcome === "submitted"));
});
