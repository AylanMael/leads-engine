import assert from "node:assert/strict";
import test from "node:test";
import { ALL_CITIES, DEPARTMENTS } from "../src/data/cities";
import { getCityCatalogue } from "../src/data/local-cities";

test("catalogue complet 78 + 92 + 20 arrondissements parisiens", () => {
  assert.deepEqual(DEPARTMENTS.map(({ cities }) => cities.length), [90, 36, 20]);
  assert.equal(new Set(ALL_CITIES.map(({ slug }) => slug)).size, 146);
  for (let n = 1; n <= 20; n++) {
    const ordinal = n === 1 ? "1er" : `${n}e`;
    const postalCode = `750${String(n).padStart(2, "0")}`;
    const city = ALL_CITIES.find(({ slug }) => slug === `paris-${ordinal}-${postalCode}`);
    assert.equal(city?.name, `Paris ${ordinal} Arrondissement`);
    assert.equal(city?.postalCode, postalCode);
  }
  for (const vertical of ["demenagement", "renovation"] as const) {
    const catalogue = getCityCatalogue(vertical);
    assert.equal(catalogue.length, 146);
    assert.ok(catalogue.every((city) => city.hasGeneratedContent && city.faq.length === 3));
    assert.equal(catalogue.find(({ slug }) => slug === "neuilly-sur-seine-92200")?.departmentName, "Hauts-de-Seine");
  }
});
