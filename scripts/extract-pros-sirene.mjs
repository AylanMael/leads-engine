#!/usr/bin/env node
// Node.js 22 : node scripts/extract-pros-sirene.mjs 78 4942Z
// Documentation : https://recherche-entreprises.api.gouv.fr/docs/
import { writeFile, rename, unlink } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { normalizeDepartment } from "./fetch-department-cities.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://recherche-entreprises.api.gouv.fr/search";
export const EMPLOYEE_BRACKETS = ["01", "02", "03", "11", "12", "21", "22", "31", "32", "41", "42", "51", "52", "53"];
const text = (value) => typeof value === "string" ? value.trim() : "";

export function normalizeNaf(value) {
  const code = text(value).toUpperCase();
  if (!/^\d{2}\.?\d{2}[A-Z]$/.test(code)) throw new Error("Code NAF invalide : utiliser 4942Z ou 49.42Z.");
  const compact = code.replace(".", "");
  return `${compact.slice(0, 2)}.${compact.slice(2)}`;
}

/** Le code INSEE distingue Corse/DOM ; le préfixe postal seul ne le permet pas. */
export function establishmentDepartment(establishment) {
  const commune = text(establishment.commune).toUpperCase();
  if (/^(2A|2B)\d{3}$/.test(commune)) return commune.slice(0, 2);
  if (/^97[12346]\d{2}$/.test(commune)) return commune.slice(0, 3);
  if (/^(0[1-9]|1\d|2[1-9]|[3-8]\d|9[0-5])\d{3}$/.test(commune)) return commune.slice(0, 2);
  // Le siège expose aussi directement le département ; ne pas le deviner du CP.
  const department = text(establishment.departement).toUpperCase();
  try { return normalizeDepartment(department); } catch { return null; }
}

function directors(company) {
  return [...new Set((Array.isArray(company.dirigeants) ? company.dirigeants : []).flatMap((person) => {
    if (!person || /commissaire aux comptes/i.test(text(person.qualite))) return [];
    const name = person.type_dirigeant === "personne morale"
      ? text(person.denomination)
      : [text(person.prenoms), text(person.nom)].filter(Boolean).join(" ");
    return name ? [name] : [];
  }))].join(" | ");
}

function publicPhone(establishment) {
  // Aucun enrichissement ni déduction : ces champs ne figurent actuellement pas
  // dans le schéma officiel, mais peuvent être conservés s'ils sont fournis.
  const phone = text(establishment.telephone || establishment.numero_telephone).replace(/[\s().-]/g, "");
  return /^\+?[0-9]{7,15}$/.test(phone) ? phone : "";
}

export function companyRows(company, department, naf) {
  if (!company || company.etat_administratif !== "A" || company.statut_diffusion !== "O" ||
      !EMPLOYEE_BRACKETS.includes(company.tranche_effectif_salarie) || company.activite_principale !== naf ||
      !/^\d{9}$/.test(company.siren)) return [];
  const establishments = [...(company.siege ? [company.siege] : []), ...(company.matching_etablissements ?? [])];
  const rows = new Map();
  for (const establishment of establishments) {
    if (!establishment || establishment.etat_administratif !== "A" || establishment.statut_diffusion_etablissement !== "O" ||
        establishmentDepartment(establishment) !== department || !/^\d{14}$/.test(establishment.siret) ||
        !establishment.siret.startsWith(company.siren)) continue;
    const row = {
      raison_sociale: text(company.nom_raison_sociale) || text(company.nom_complet),
      nom_dirigeant: directors(company),
      commune: text(establishment.libelle_commune),
      code_postal: text(establishment.code_postal),
      telephone: publicPhone(establishment),
      siret: establishment.siret,
      siren: company.siren,
      naf_entreprise: company.activite_principale,
      tranche_effectif_entreprise: company.tranche_effectif_salarie,
      annee_effectif: text(company.annee_tranche_effectif_salarie),
      source: `https://annuaire-entreprises.data.gouv.fr/etablissement/${establishment.siret}`,
    };
    // Siège/matching peuvent contenir le même SIRET ; conserver le plus complet.
    const previous = rows.get(row.siret);
    if (previous) for (const key of Object.keys(row)) if (!row[key]) row[key] = previous[key];
    rows.set(row.siret, row);
  }
  return [...rows.values()];
}

export const COLUMNS = ["raison_sociale", "nom_dirigeant", "commune", "code_postal", "telephone", "siret", "siren", "naf_entreprise", "tranche_effectif_entreprise", "annee_effectif", "source"];
export function toCsv(rows) {
  const cell = (value, column) => {
    let content = String(value ?? "").replace(/\u0000/g, "");
    // Empêche l'interprétation de texte public comme formule par un tableur.
    // Un téléphone validé +<chiffres> ne contient aucune expression.
    if (/^\s*[=+@-]/.test(content) && !(column === "telephone" && /^\+\d{7,15}$/.test(content))) content = `'${content}`;
    return `"${content.replace(/"/g, '""')}"`;
  };
  return `\uFEFF${COLUMNS.join(";")}\r\n${rows.map((row) => COLUMNS.map((key) => cell(row[key], key)).join(";")).join("\r\n")}${rows.length ? "\r\n" : ""}`;
}

/** Une requête/seconde, timeout et trois tentatives sur erreurs temporaires. */
export function createApiClient({ fetchImpl = fetch, wait = sleep, now = Date.now } = {}) {
  let lastRequest = -Infinity;
  return async (url) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await wait(Math.max(0, 1000 - (now() - lastRequest)));
      lastRequest = now();
      let response;
      try {
        response = await fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(20_000), redirect: "error" });
      } catch {
        if (attempt === 2) throw new Error("API inaccessible après trois tentatives. Aucun CSV partiel publié.");
        await wait(1000 * 2 ** attempt);
        continue;
      }
      if (response.ok) return response.json();
      const retry = response.status === 429 || response.status >= 500;
      if (!retry || attempt === 2) throw new Error(`API HTTP ${response.status}. Aucun CSV partiel publié.`);
      const header = response.headers.get("retry-after");
      const delay = header && /^\d+$/.test(header) ? Number(header) * 1000 : header ? Date.parse(header) - now() : 0;
      const pause = Math.max(1000 * 2 ** attempt, Number.isFinite(delay) ? delay : 0);
      if (pause > 60_000) throw new Error(`Quota API : réessayer dans au moins ${Math.ceil(pause / 1000)} secondes. Aucun CSV partiel publié.`);
      await wait(pause);
    }
  };
}

export async function extractPros(departmentInput, nafInput, { get = createApiClient(), progress = console.log } = {}) {
  const department = normalizeDepartment(departmentInput);
  const naf = normalizeNaf(nafInput);
  const rows = new Map();
  const seenCompanies = new Set();
  let totalPages = 1;
  let totalResults;
  for (let page = 1; page <= totalPages; page++) {
    let establishmentPage = 1;
    let previousFingerprint;
    let pageCompanies;
    while (true) {
      const url = new URL(API);
      url.search = new URLSearchParams({ departement: department, activite_principale: naf, etat_administratif: "A",
        tranche_effectif_salarie: EMPLOYEE_BRACKETS.join(","), page: String(page), per_page: "25",
        limite_matching_etablissements: "100", page_etablissements: String(establishmentPage),
        minimal: "true", include: "siege,dirigeants,matching_etablissements" }).toString();
      const payload = await get(url);
      if (!payload || !Array.isArray(payload.results) || payload.page !== page || payload.per_page !== 25 ||
          !Number.isSafeInteger(payload.total_pages) || payload.total_pages < 0 ||
          !Number.isSafeInteger(payload.total_results) || payload.total_results < 0) throw new Error("Pagination API invalide.");
      if (payload.total_results > 10_000 || payload.total_pages > 400 || payload.total_pages < Math.ceil(payload.total_results / 25)) {
        throw new Error("Volume supérieur à la pagination fiable de l’API Recherche. Utiliser un export Sirene pour ce périmètre ; aucun CSV tronqué publié.");
      }
      totalResults ??= payload.total_results;
      if (totalResults !== payload.total_results) throw new Error("Les résultats ont changé pendant l’export. Relancer pour éviter une liste incomplète.");
      totalPages = payload.total_pages;
      const ids = payload.results.map((company) => company.siren).sort().join(",");
      pageCompanies ??= ids;
      if (ids !== pageCompanies) throw new Error("La pagination des établissements a changé les entreprises retournées.");
      const fingerprint = JSON.stringify(payload.results.map((company) => [company.siren, company.matching_etablissements]));
      if (fingerprint === previousFingerprint) throw new Error("Pagination des établissements répétée par l’API ; export interrompu.");
      previousFingerprint = fingerprint;
      for (const company of payload.results) {
        if (!/^\d{9}$/.test(company.siren) || !Array.isArray(company.matching_etablissements)) throw new Error("Entreprise ou établissements mal formés dans la réponse API.");
        if (establishmentPage === 1) {
          if (seenCompanies.has(company.siren)) throw new Error("Entreprise répétée sur deux pages ; relancer l’export.");
          seenCompanies.add(company.siren);
        }
        for (const row of companyRows(company, department, naf)) rows.set(row.siret, row);
      }
      if (!payload.results.some((company) => company.matching_etablissements.length >= 100)) break;
      establishmentPage++;
      if (establishmentPage > 100) throw new Error("Trop d’établissements pour un export fiable via cette API.");
    }
    progress(`Page ${page}/${Math.max(1, totalPages)} : ${rows.size} établissements retenus.`);
  }
  if (seenCompanies.size !== totalResults) throw new Error("Nombre d’entreprises incohérent ; aucun CSV partiel publié.");
  return { department, naf, scanned: seenCompanies.size,
    rows: [...rows.values()].sort((a, b) => a.siret.localeCompare(b.siret)) };
}

export async function writeExport(result, outputDir = ROOT) {
  const path = resolve(outputDir, `partners-to-contact-${result.department}-${result.naf.replace(".", "")}.csv`);
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, toCsv(result.rows), { flag: "wx" });
    await rename(temporary, path);
  } finally {
    await unlink(temporary).catch((error) => { if (error.code !== "ENOENT") throw error; });
  }
  return path;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log("Usage : node scripts/extract-pros-sirene.mjs <département> <NAF> (ex. 78 4942Z)"); return; }
  if (args.length !== 2) throw new Error("Usage : node scripts/extract-pros-sirene.mjs <département> <NAF>");
  const result = await extractPros(...args);
  const path = await writeExport(result);
  const companies = new Set(result.rows.map((row) => row.siren)).size;
  const phones = result.rows.filter((row) => row.telephone).length;
  console.log(`${result.scanned} entreprises examinées ; ${companies} entreprises et ${result.rows.length} établissements exportés ; ${phones} téléphones publiés.\nCSV : ${path}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(`Extraction Sirene : ${error.message}`); process.exitCode = 1; });
}
