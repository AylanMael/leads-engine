#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { slugify } from "./fetch-department-cities.mjs";

// Aucun filtre de population : toutes les communes du 92, tous les arrondissements du 75.
const sources = [
  { code: "92", name: "Hauts-de-Seine", count: 36, url: "https://geo.api.gouv.fr/departements/92/communes?fields=nom,code,codesPostaux" },
  { code: "75", name: "Paris", count: 20, url: "https://geo.api.gouv.fr/communes?codeDepartement=75&type=arrondissement-municipal&fields=nom,code,codesPostaux" },
];
for (const department of sources) {
  const response = await fetch(department.url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Géographie ${department.code} : HTTP ${response.status}`);
  const raw = await response.json();
  if (!Array.isArray(raw) || raw.length !== department.count) throw new Error(`Nombre inattendu de zones pour ${department.code}`);
  const cities = raw.map((city) => {
    const number = Number(city.code.slice(-2));
    if (department.code === "75" && (!/^751\d{2}$/.test(city.code) || number < 1 || number > 20)) throw new Error("Arrondissement parisien invalide");
    const postalCode = [...city.codesPostaux].sort()[0];
    if (!new RegExp(`^${department.code}\\d{3}$`).test(postalCode)) throw new Error(`Code postal invalide : ${city.nom}`);
    const ordinal = number === 1 ? "1er" : `${number}e`;
    return {
      slug: department.code === "75" ? `paris-${ordinal}-${postalCode}` : `${slugify(city.nom)}-${postalCode}`,
      name: department.code === "75" ? `Paris ${ordinal} Arrondissement` : city.nom,
      postalCode, departmentCode: department.code, departmentName: department.name,
      inseeCode: city.code,
      context: { housingType: "À enrichir : caractéristiques à vérifier à l’adresse du projet.", trafficNote: "À enrichir : accès et démarches locales.", neighborhoods: [] },
      faq: [],
      localFacts: [{ fact: `${city.nom} : code INSEE ${city.code}, code postal ${postalCode}.`, source: department.url }],
    };
  }).sort((a, b) => a.postalCode.localeCompare(b.postalCode) || a.slug.localeCompare(b.slug));
  if (new Set(cities.map(({ slug }) => slug)).size !== department.count) throw new Error("Slugs dupliqués");
  await writeFile(new URL(`../src/data/cities-${department.code}.json`, import.meta.url), JSON.stringify(cities, null, 2) + "\n");
  console.log(`${department.name} : ${cities.length} zones écrites.`);
}
