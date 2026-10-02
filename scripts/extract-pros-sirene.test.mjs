import test from "node:test";
import assert from "node:assert/strict";
import { normalizeNaf, establishmentDepartment, companyRows, toCsv, extractPros, createApiClient } from "./extract-pros-sirene.mjs";

const establishment = { siret: "12345678900011", commune: "78646", libelle_commune: "VERSAILLES", code_postal: "78000", etat_administratif: "A", statut_diffusion_etablissement: "O" };
const company = { siren: "123456789", nom_raison_sociale: "Entreprise test", activite_principale: "49.42Z", etat_administratif: "A", statut_diffusion: "O", tranche_effectif_salarie: "01", dirigeants: [{ prenoms: "Alex", nom: "Test", type_dirigeant: "personne physique" }], matching_etablissements: [establishment] };

test("NAF et géographie : normalisation, Corse et DOM", () => {
  assert.equal(normalizeNaf("4942z"), "49.42Z");
  assert.equal(normalizeNaf("43.22A"), "43.22A");
  assert.throws(() => normalizeNaf("../../49"));
  assert.equal(establishmentDepartment({ commune: "2A004", code_postal: "20000" }), "2A");
  assert.equal(establishmentDepartment({ commune: "2B033" }), "2B");
  assert.equal(establishmentDepartment({ commune: "97411" }), "974");
});

test("effectif non filtré ; activité, établissement fermé/hors zone exclus", () => {
  for (const tranche of [null, "NN", "00"]) assert.equal(companyRows({ ...company, tranche_effectif_salarie: tranche }, "78", "49.42Z").length, 1);
  assert.deepEqual(companyRows({ ...company, etat_administratif: "C" }, "78", "49.42Z"), []);
  for (const change of [{ etat_administratif: "F" }, { commune: "75101" }, { statut_diffusion_etablissement: "P" }]) {
    assert.deepEqual(companyRows({ ...company, matching_etablissements: [{ ...establishment, ...change }] }, "78", "49.42Z"), []);
  }
});

test("siège hors département, établissement local et absence de téléphone", () => {
  const rows = companyRows({ ...company, siege: { ...establishment, siret: "12345678900022", commune: "75101" } }, "78", "49.42Z");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].siret, establishment.siret);
  assert.equal(rows[0].nom_dirigeant, "Alex Test");
  assert.equal(rows[0].telephone, "");
  assert.equal(companyRows({ ...company, siege: establishment }, "78", "49.42Z").length, 1);
});

test("adresse, enseigne et priorité au dirigeant exécutif disponible", () => {
  const [row] = companyRows({ ...company,
    dirigeants: [{ prenoms: "Audit", nom: "Exclu", qualite: "Commissaire aux comptes" }, { prenoms: "Alex", nom: "Principal", qualite: "Président" }],
    matching_etablissements: [{ ...establishment, adresse: "1 RUE TEST 78000 VERSAILLES", liste_enseignes: ["Enseigne test"] }],
  }, "78", "49.42Z");
  assert.equal(row.adresse, "1 RUE TEST 78000 VERSAILLES");
  assert.equal(row.nom_commercial, "Enseigne test");
  assert.equal(row.nom_dirigeant, "Alex Principal");
});

test("CSV : UTF-8 BOM, guillemets, séparateurs et neutralisation de formules", () => {
  const csv = toCsv([{ raison_sociale: '=HYPERLINK("x")', nom_dirigeant: 'A;"B"\nC', telephone: "+33123456789" }]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'));
  assert.ok(csv.includes('"A;""B""\nC"'));
  assert.ok(csv.includes('"+33123456789"'));
});

test("pagination établissements : conserve les filtres, aucun lookup SIREN", async () => {
  let calls = 0;
  const many = Array.from({ length: 100 }, (_, i) => ({ ...establishment, siret: `123456789${String(i).padStart(5, "0")}` }));
  const result = await extractPros("78", "4942Z", { progress: () => {}, get: async (url) => {
    calls++;
    assert.equal(url.searchParams.get("departement"), "78");
    assert.equal(url.searchParams.has("q"), false);
    return { page: 1, per_page: 25, total_pages: 1, total_results: 1, results: [{ ...company, matching_etablissements: calls === 1 ? many : [{ ...establishment, siret: "12345678900101" }] }] };
  } });
  assert.equal(calls, 2);
  assert.equal(result.rows.length, 101);
});

test("429 : Retry-After et nombre borné de tentatives", async () => {
  let calls = 0;
  let time = 0;
  const get = createApiClient({ now: () => time, wait: async (ms) => { time += ms; }, fetchImpl: async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 429, headers: { "Retry-After": "3" } }) : Response.json({ results: [] });
  } });
  await get(new URL("https://example.com"));
  assert.equal(calls, 2);
  assert.ok(time >= 3000);
});
