import test from "node:test";
import assert from "node:assert/strict";
import { jaccard, wordTrigrams, generateCity, createGenerator, closestMatch, validateContent, parseArguments, sourceHash } from "./generate-city-content.mjs";
import { validateCatalogue } from "../src/lib/city-content.mjs";
import { validateDepartmentContent } from "../src/lib/department-context.mjs";

const city = { slug: "versailles-78000", name: "Versailles", postalCode: "78000", departmentCode: "78", departmentName: "Yvelines", context: { housingType: "À enrichir : bâti", trafficNote: "À enrichir : stationnement", neighborhoods: [] }, faq: [] };
const content = {
  headline: "Déménager un appartement à Versailles : mesurer avant de réserver",
  accessNotice: "Avant de réserver le véhicule, contactez la mairie pour vérifier les modalités de stationnement à votre adresse exacte.",
  faq: [
    { question: "Comment mesurer le volume ?", answer: "Dressez un inventaire de vos meubles et cartons avec leurs dimensions pour préparer une estimation adaptée." },
    { question: "Que faut-il vérifier dans les escaliers ?", answer: "Mesurez les passages et les angles du palier avant de déplacer les objets les plus encombrants." },
    { question: "Comment organiser le chargement ?", answer: "Placez les cartons fragiles à part et transmettez au professionnel un inventaire précis avant la visite technique." },
  ],
};

test("contexte parisien : rejette horaires inventés et confusion CITE/bruit", () => {
  const paris = { ...city, departmentCode: "75" };
  assert.throws(() => validateDepartmentContent({ ...content, accessNotice: "Travaux autorisés de 8h à 20h." }, paris, "renovation"), /Horaires/);
  assert.throws(() => validateDepartmentContent({ ...content, accessNotice: "Consultez CITE pour les horaires autorisés de bruit." }, paris, "renovation"), /CITE/);
  assert.throws(() => validateDepartmentContent({ ...content, accessNotice: "Sans autorisation de stationnement, vous serez verbalisé." }, paris, "demenagement"), /AOT/);
});

test("trigrammes normalisés, sets et seuil exact", () => {
  assert.deepEqual(wordTrigrams("Étage, escalier : étroit !"), new Set(["etage escalier etroit"]));
  assert.equal(jaccard("un deux trois quatre", "un deux trois quatre"), 1);
  assert.equal(jaccard("un deux trois", "cinq six sept"), 0);
  assert.equal(jaccard(new Set(["a", "b"]), new Set(["a", "c", "d"])), 0.25);
  assert.equal(jaccard("", ""), 1);
});

test("comparaison avec tout le département, sans mélange de départements", () => {
  const prior = { ...city, slug: "autre", ...content };
  assert.equal(closestMatch(content, city, [prior]).score, 1);
  assert.equal(closestMatch(content, city, [{ ...prior, departmentCode: "75" }]).score, 0);
});

test("deux nouvelles tentatives maximum avec température et angle différents", async () => {
  const calls = [];
  await assert.rejects(generateCity(city, "demenagement", [{ ...city, slug: "autre", ...content }], async (input) => {
    calls.push(input);
    return content;
  }), /Similarité/);
  assert.equal(calls.length, 3);
  assert.equal(calls[0].temperature, 0.4);
  assert.equal(calls[1].temperature, 0.85);
  assert.equal(calls[2].temperature, 1);
  assert.equal(calls[1].avoid.slug, "autre");
  assert.match(calls[1].feedback, /100.00/);
});

test("JSON invalide retenté ; JSON valide accepté", async () => {
  let count = 0;
  const result = await generateCity(city, "renovation", [], async () => ++count === 1 ? null : content);
  assert.equal(result.attempts, 2);
  assert.equal(result.maxSimilarity, 0);
  assert.throws(() => validateContent({ ...content, extra: true }));
  assert.throws(() => validateContent({ ...content, headline: "Au cœur de " + content.headline }));
  assert.throws(() => validateContent({ ...content, faq: content.faq.slice(0, 2) }));
});

test("commandes courtes et ancien ordre des arguments", () => {
  assert.equal(parseArguments(["demenagement"]).vertical, "demenagement");
  assert.match(parseArguments(["renovation"]).input, /cities-78\.json$/);
  assert.equal(parseArguments(["src/data/cities-78.json", "renovation"]).input, parseArguments(["renovation"]).input);
  assert.throws(() => parseArguments(["invalide"]));
});

test("validation de catalogue : scores recalculés, doublons et mauvais vertical rejetés", () => {
  const row = { ...content, slug: city.slug, departmentCode: "78", vertical: "demenagement", generation: {
    model: "test", generatedAt: "2026-10-01T00:00:00.000Z", attempts: 1, maxSimilarity: 0, sourceHash: sourceHash(city),
  } };
  assert.equal(validateCatalogue([row], "demenagement").length, 1);
  assert.throws(() => validateCatalogue([row], "renovation"));
  assert.throws(() => validateCatalogue([row, row], "demenagement"));
  assert.throws(() => validateCatalogue([row, { ...row, slug: "autre-78000" }], "demenagement"), /Similarité/);
  assert.notEqual(sourceHash(city), sourceHash({ ...city, name: "Autre commune" }));
});

test("quota temporaire : attente bornée puis nouvelle tentative", async () => {
  let calls = 0;
  const waits = [];
  const generate = createGenerator({ apiKey: "test", model: "test", wait: async (ms) => waits.push(ms), fetchImpl: async () => {
    calls++;
    if (calls === 1) return { ok: false, status: 429, headers: new Headers({ "retry-after": "2" }) };
    return { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }] }) };
  } });
  assert.deepEqual(await generate({ city, vertical: "demenagement", attempt: 0, temperature: 0.4 }), content);
  assert.deepEqual(waits, [2000]);
});

test("connecteur API : JSON strict, données manquantes et angle de reprise", async () => {
  let sent;
  const generate = createGenerator({ apiKey: "test", model: "test-model", fetchImpl: async (_, options) => {
    sent = JSON.parse(options.body);
    return { ok: true, json: async () => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify(content) } }] }) };
  } });
  const result = await generate({ city, vertical: "renovation", attempt: 1, temperature: 0.85, feedback: "Similarité" });
  assert.deepEqual(result, content);
  assert.equal(sent.temperature, 0.85);
  assert.equal(sent.response_format.json_schema.strict, true);
  const input = JSON.parse(sent.messages[1].content);
  assert.equal(input.city.context.housingType, null);
  assert.match(input.angle, /change le plan/);
});

test("une erreur API interrompt sans multiplier les appels", async () => {
  let count = 0;
  const generate = createGenerator({ apiKey: "test", model: "test", fetchImpl: async () => { count++; return { ok: false, status: 401 }; } });
  await assert.rejects(generateCity(city, "demenagement", [], generate), /API HTTP 401/);
  assert.equal(count, 1);
});
