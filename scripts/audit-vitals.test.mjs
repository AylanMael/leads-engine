import test from "node:test";
import assert from "node:assert/strict";
import { sampleRoutes, sitemapPaths, summarizeLighthouse, gateFailures } from "./audit-vitals.mjs";

test("sitemap : extraire les communes réelles, sans inventer des pages à partir du catalogue", () => {
  assert.deepEqual(sitemapPaths('<urlset><url><loc>https://site.fr/demenagement/ville-a</loc></url><url><loc>https://site.fr/partenaire</loc></url></urlset>'), ["/demenagement/ville-a"]);
});

const manifest = (paths) => ({ routes: Object.fromEntries(paths.map((path) => [path, {}])) });
test("cinq routes uniques, deux verticaux, sans routes techniques", () => {
  const input = manifest(["/", "/robots.txt", "/partenaire", ...Array.from({ length: 6 }, (_, i) => `/demenagement/ville-${i}`), "/renovation/ville-1"]);
  const result = sampleRoutes(input, () => 0);
  assert.equal(result.selected.length, 5);
  assert.equal(new Set(result.selected.map((item) => item.path)).size, 5);
  assert.deepEqual(new Set(result.selected.map((item) => item.vertical)), new Set(["demenagement", "renovation"]));
  assert.deepEqual(result.errors, []);
});
test("catalogue incomplet : audit diagnostique mais gate bloquant", () => {
  const result = sampleRoutes(manifest(["/demenagement/ville-a", "/demenagement/ville-b", "/demenagement/ville-c"]), () => 0);
  assert.equal(result.selected.length, 3);
  assert.equal(result.errors.length, 2);
});
test("métriques Lighthouse : unités brutes, pas de faux INP dérivé du TBT", () => {
  const result = summarizeLighthouse({ categories: { performance: { score: 0.899 }, seo: { score: 0.95 } },
    audits: { "largest-contentful-paint": { numericValue: 2200 }, "cumulative-layout-shift": { numericValue: 0.02 }, "total-blocking-time": { numericValue: 120 } } });
  assert.equal(result.performance, 89.9);
  assert.equal(result.lcpMs, 2200);
  assert.equal(result.cls, 0.02);
  assert.equal(result.tbtMs, 120);
  assert.equal(result.inpLabMs, undefined);
});
const good = { path: "/demenagement/ville-a", performance: 90, seo: 90, lcpMs: 2200, cls: 0, inpLabMs: 48 };
test("seuils stricts : 90 passe, 89,9 échoue, pas de moyenne entre pages", () => {
  assert.deepEqual(gateFailures([good]), []);
  assert.ok(gateFailures([good, { ...good, performance: 89.9 }]).length);
  assert.ok(gateFailures([{ ...good, seo: 89.9 }]).length);
});
test("absence de métrique, erreur et absence de pages restent bloquantes", () => {
  assert.ok(gateFailures([{ ...good, inpLabMs: null }]).length);
  assert.ok(gateFailures([{ ...good, performance: null }]).length);
  assert.ok(gateFailures([{ ...good, error: "404" }]).length);
  assert.ok(gateFailures([]).length);
  assert.ok(gateFailures([good], ["Rénovation absente"]).length);
});
