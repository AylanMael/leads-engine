import assert from "node:assert/strict";
import test from "node:test";
import { getSiteConfig, getCanonicalUrl, getSiteMetadata, getOrganization } from "../src/config/site";
import { getTenantConfig } from "../src/config/tenant";
import sitemap from "../src/app/sitemap";
import robots from "../src/app/robots";
import cities from "../src/data/cities-78.json";

test("chaque déploiement partage sa marque entre affichage, SEO, sitemap et robots", () => {
  const previous = process.env.NEXT_PUBLIC_VERTICAL;
  try {
    for (const [vertical, brand, domain] of [["renovation", "Rénovizo", "https://renovizo.fr"], ["demenagement", "Déménizo", "https://demenizo.fr"]]) {
      process.env.NEXT_PUBLIC_VERTICAL = vertical;
      const site = getSiteConfig();
      assert.equal(site.brandName, brand);
      assert.equal(site.domain, domain);
      assert.equal(getTenantConfig().brandName, brand);
      assert.equal(getTenantConfig().legalEntity, site.legalName);
      assert.equal(getSiteMetadata(site).metadataBase?.origin, domain);
      assert.equal(getCanonicalUrl(site, "versailles-78000"), `${domain}/${vertical}/versailles-78000`);
      assert.equal(getOrganization(site).url, `${domain}/`);
      assert.equal(robots().sitemap, `${domain}/sitemap.xml`);
      const entries = sitemap();
      assert.equal(entries.length, cities.length + 1);
      assert.equal(entries[0].url, `${domain}/`);
      assert.ok(entries.slice(1).every(({ url }) => url.startsWith(`${domain}/${vertical}/`)));
      assert.equal(new Set(entries.map(({ url }) => url)).size, entries.length);
    }
    delete process.env.NEXT_PUBLIC_VERTICAL;
    assert.equal(getSiteConfig().vertical, "demenagement");
    process.env.NEXT_PUBLIC_VERTICAL = "invalid";
    assert.equal(getSiteConfig().vertical, "demenagement");
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_VERTICAL;
    else process.env.NEXT_PUBLIC_VERTICAL = previous;
  }
});
