#!/usr/bin/env node

// Node.js 18+ : node scripts/fetch-department-cities.mjs 78
// Documentation : https://geo.api.gouv.fr/decoupage-administratif/communes
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const MIN_POPULATION = 3_000;
const API_BASE = "https://geo.api.gouv.fr";

export function normalizeDepartment(value) {
  const code = value?.trim().toUpperCase();
  if (!code || !/^(?:0[1-9]|1[0-9]|2[1-9]|[3-8][0-9]|9[0-5]|2[AB]|97[12346])$/.test(code)) {
    throw new Error("Département invalide. Usage : node scripts/fetch-department-cities.mjs <code> (ex. 78, 2A, 974).");
  }
  return code;
}

export function slugify(name) {
  return name.normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Prépare la forme de City, sans inventer de contenu local.
 * Les quartiers, contextes et FAQ doivent être enrichis avant publication.
 * neighborhoods et faq vides ne satisfont volontairement pas CitySchema.
 */
export function prepareCities(communes, department) {
  if (!Array.isArray(communes) || !department || typeof department.nom !== "string" || !department.nom.trim()) {
    throw new Error("Réponse API invalide : liste de communes ou nom du département manquant.");
  }
  const departmentCode = normalizeDepartment(department.code);
  const cities = [];
  const slugs = new Set();
  let population = 0;
  let missingPopulation = 0;
  let multiplePostalCodes = 0;

  for (const commune of communes) {
    if (!commune || typeof commune !== "object") throw new Error("Réponse API invalide : commune mal formée.");
    if (commune.population == null) {
      missingPopulation++;
      continue;
    }
    if (!Number.isSafeInteger(commune.population) || commune.population < 0) {
      throw new Error(`Population invalide pour la commune ${commune.code ?? "inconnue"}.`);
    }
    if (commune.population < MIN_POPULATION) continue;
    if (typeof commune.nom !== "string" || !commune.nom.trim() || !Array.isArray(commune.codesPostaux)) {
      throw new Error(`Nom ou codes postaux manquants pour la commune ${commune.code ?? "inconnue"}.`);
    }

    const postalCodes = [...new Set(commune.codesPostaux)];
    if (!postalCodes.length || postalCodes.some((code) => typeof code !== "string" || !/^[0-9]{5}$/.test(code))) {
      throw new Error(`Codes postaux invalides pour ${commune.nom}.`);
    }
    // L'API ne désigne pas de code principal : choix déterministe à vérifier.
    const postalCode = postalCodes.sort()[0];
    if (postalCodes.length > 1) multiplePostalCodes++;
    const normalizedName = slugify(commune.nom);
    if (!normalizedName) throw new Error(`Impossible de générer un slug pour ${commune.nom}.`);
    const slug = `${normalizedName}-${postalCode}`;
    if (slugs.has(slug)) throw new Error(`Slug dupliqué : ${slug}. Aucun fichier ne sera écrit.`);
    slugs.add(slug);

    cities.push({
      slug,
      name: commune.nom.trim(),
      postalCode,
      departmentCode,
      departmentName: department.nom.trim(),
      context: {
        housingType: "À enrichir : bâti prédominant de la commune.",
        trafficNote: "À enrichir : accès et démarches locales de stationnement.",
        neighborhoods: [],
      },
      faq: [],
    });
    population += commune.population;
  }

  cities.sort((a, b) => a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0);
  return { cities, population, missingPopulation, multiplePostalCodes };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`API : HTTP ${response.status} pour ${url}`);
  return response.json();
}

export async function main(args = process.argv.slice(2)) {
  if (args.length !== 1) throw new Error("Usage : node scripts/fetch-department-cities.mjs <code-departement>");
  const dep = normalizeDepartment(args[0]);
  const [department, communes] = await Promise.all([
    fetchJson(`${API_BASE}/departements/${dep}`),
    fetchJson(`${API_BASE}/departements/${dep}/communes?fields=nom,code,codesPostaux,population`),
  ]);
  if (department?.code !== dep) throw new Error("Le département renvoyé par l’API ne correspond pas à la demande.");
  const result = prepareCities(communes, department);
  // Chemin indépendant du répertoire depuis lequel la commande est exécutée.
  const output = fileURLToPath(new URL(`../src/data/cities-${dep}.json`, import.meta.url));
  await mkdir(dirname(output), { recursive: true });
  const temporary = `${output}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(result.cities, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await rename(temporary, output);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }

  const format = new Intl.NumberFormat("fr-FR");
  console.log(`${department.nom} (${dep}) : ${result.cities.length} communes extraites sur ${communes.length} (population ≥ ${format.format(MIN_POPULATION)}).`);
  console.log(`Population totale couverte : ${format.format(result.population)} habitants.`);
  if (result.missingPopulation) console.log(`${result.missingPopulation} communes exclues faute de population renseignée.`);
  console.log(`${result.multiplePostalCodes} communes avec plusieurs codes postaux : premier code trié retenu, à vérifier.`);
  console.log(`Fichier écrit : ${output}`);
  console.log("Fiches à enrichir avant publication : contexte, 2 à 3 quartiers réels et FAQ (CitySchema).");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Échec de l’extraction : ${error.message}`);
    process.exitCode = 1;
  });
}
