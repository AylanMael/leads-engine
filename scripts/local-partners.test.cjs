// Exécute les handlers contre des fichiers temporaires, sans toucher aux leads de développement.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const syncFs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(
  syncFs.readFileSync(filename, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
).outputText, filename);

async function main() {
  const root = path.resolve(__dirname, "..");
  const previousDirectory = process.cwd();
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "local-partners-"));
  const dataDirectory = path.join(temporaryDirectory, "src/data");
  try {
    await fs.mkdir(dataDirectory, { recursive: true });
    await fs.copyFile(path.join(root, "src/data/partners-local.json"), path.join(dataDirectory, "partners-local.json"));
    process.chdir(temporaryDirectory);
    process.env.NODE_ENV = "development";
    const leads = require(path.join(root, "src/app/api/leads/route.ts"));
    const partners = require(path.join(root, "src/app/api/partners/route.ts"));
    const assign = require(path.join(root, "src/app/api/leads/assign/route.ts"));
    const { withLocalStore } = require(path.join(root, "src/lib/local-store.ts"));
    const request = (body) => new Request("http://localhost/api", { method: "POST", body: JSON.stringify(body) });
    const list = () => leads.GET(new Request("http://localhost/api/leads")).then((response) => response.json());
    const profiles = () => partners.GET().then((response) => response.json());
    const snapshot = await profiles();
    assert.equal(snapshot.length, 2);
    // Fixe les soldes du scénario indépendamment des recharges manuelles précédentes.
    await withLocalStore(({ partners }) => partners.forEach((partner) => { partner.credits = partner.vertical === "demenagement" ? 5 : 1; }), true);
    const customer = { firstName: "Test", lastName: "Local", phone: "0684275931", email: "test@example.com" };
    const renovation = { vertical: "renovation", geo: { departureCity: "Versailles", departurePostalCode: "78000" }, projectType: "cuisine", property: { occupancyStatus: "proprietaire_occupant", surface: 20, buildingType: "maison" }, budgetBracket: "10k-30k", customer: { ...customer, salutation: "madame" } };
    const create = async (lead) => {
      const response = await leads.POST(request(lead)); assert.equal(response.status, 201);
      return (await response.json()).id;
    };
    const first = await create(renovation);
    const second = await create(renovation);
    const allocation = (leadId, partnerId = "part-renov-78") => assign.POST(request({ leadId, partnerId }));
    assert.equal((await allocation(first, "part-dem-78")).status, 409);
    const outside = await create({ ...renovation, geo: { departureCity: "Paris", departurePostalCode: "75001" } });
    assert.equal((await allocation(outside)).status, 409);
    const missingGeo = { ...renovation }; delete missingGeo.geo;
    assert.equal((await allocation(await create(missingGeo))).status, 409);
    const raced = await Promise.all([allocation(first), allocation(second)]);
    assert.deepEqual(raced.map((response) => response.status).sort(), [200, 409]);
    const assigned = (await list()).find((lead) => lead.status === "assigned");
    assert.ok(assigned.assignedAt);
    assert.deepEqual(assigned.assignedPartners, ["part-renov-78"]);
    assert.equal((await profiles()).find((partner) => partner.id === "part-renov-78").credits, 0);
    assert.equal((await allocation(assigned.id)).status, 200);
    assert.equal((await profiles()).find((partner) => partner.id === "part-renov-78").credits, 0);
    assert.equal((await partners.POST(request({ partnerId: "part-renov-78", credits: -5 }))).status, 400);
    assert.equal((await partners.POST(request({ partnerId: "missing" }))).status, 404);
    assert.equal((await partners.POST(request({ partnerId: "part-renov-78", credits: 5 }))).status, 200);
    assert.equal((await profiles()).find((partner) => partner.id === "part-renov-78").credits, 5);
    const filtered = await (await leads.GET(new Request("http://localhost/api/leads?partnerId=part-dem-78"))).json();
    assert.deepEqual(filtered, []);
    assert.equal((await (await leads.GET(new Request("http://localhost/api/leads?partnerId=part-renov-78"))).json()).length, 1);
    const movingId = await create({
      vertical: "demenagement", customer,
      geo: { departureCity: "Versailles", departurePostalCode: "78000", arrivalCity: "Paris", arrivalPostalCode: "75001" },
      projectDetails: { housingType: "maison", surface: 90, departureFloor: 0, arrivalFloor: 2, departureElevator: false, arrivalElevator: true, targetDate: "2026-12-01" },
    });
    assert.equal((await allocation(movingId, "part-dem-78")).status, 200);
    assert.equal((await profiles()).find((partner) => partner.id === "part-dem-78").credits, 4);
    assert.equal((await (await leads.GET(new Request("http://localhost/api/leads?partnerId=part-dem-78"))).json()).length, 1);
    // Reprise après interruption entre les deux écritures JSON.
    const journal = { leads: await list(), partners: await profiles() };
    journal.partners[0].credits = 12;
    await fs.writeFile(path.join(dataDirectory, "local-store-journal.json"), JSON.stringify(journal));
    assert.equal((await profiles())[0].credits, 12);
    await assert.rejects(fs.access(path.join(dataDirectory, "local-store-journal.json")));
    process.env.NODE_ENV = "production";
    assert.equal((await partners.GET()).status, 404);
    assert.equal((await partners.POST(request({ partnerId: "part-renov-78" }))).status, 404);
    assert.equal((await allocation(first)).status, 404);
    assert.equal((await leads.GET(new Request("http://localhost/api/leads"))).status, 404);
    console.log("OK : attribution, concurrence, absence de double débit, recharge, filtrage, reprise du journal et restrictions de production.");
  } finally {
    process.chdir(previousDirectory);
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
