const test = require("node:test");
const assert = require("node:assert/strict");
const { Timestamp } = require("firebase-admin/firestore");
const { retentionCutoff, customerIsMasked, anonymizeExpiredLeads, rgpdAnonymization } = require("../lib/cron/rgpdAnonymization");

const reference = new Date("2026-10-01T00:00:00Z");
function fixture(count) {
  const cutoff = retentionCutoff(reference).getTime();
  const docs = Array.from({ length: count }, (_, i) => ({ id: String(i).padStart(5, "0"), value: {
    createdAt: Timestamp.fromMillis(cutoff - 1), customer: { firstName: "Test", lastName: "Client", phone: "0612345678", email: "test@example.com", salutation: "madame" },
    geo: { departureCity: "Versailles", departurePostalCode: "78000" }, projectDetails: { surface: 50 }, status: "assigned",
  } }));
  docs.push({ id: "boundary", value: { createdAt: Timestamp.fromMillis(cutoff), customer: { firstName: "Conservé" } } });
  docs.push({ id: "missing-date", value: { customer: { firstName: "Sans date" } } });
  let pages = 0;
  const query = (cursor = "", limit = 200, threshold = Infinity) => ({
    where(field, operator, value) { assert.equal(field, "createdAt"); assert.equal(operator, "<"); return query(cursor, limit, value.toMillis()); },
    orderBy() { return this; }, limit(value) { return query(cursor, value, threshold); },
    startAfter(value) { return query(value.id, limit, threshold); },
    rows: () => docs.filter((doc) => doc.value.createdAt?.toMillis() < threshold && doc.id > cursor).slice(0, limit),
  });
  const db = { collection(name) { assert.equal(name, "leads"); return query(); },
    async runTransaction(callback) {
      pages++;
      // Rejouer le callback une fois avant de valider ses écritures.
      let result;
      for (let attempt = 0; attempt < 2; attempt++) {
        const updates = [];
        result = await callback({ get: async (q) => {
          assert.equal(updates.length, 0);
          const selected = q.rows().map((doc) => ({ id: doc.id, ref: doc, data: () => doc.value }));
          return { docs: selected, size: selected.length };
        }, update: (ref, patch) => updates.push({ ref, patch }) });
        if (attempt === 1) for (const { ref, patch } of updates) {
          ref.value.customer = { ...ref.value.customer };
          for (const [field, value] of Object.entries(patch)) {
            if (field.startsWith("customer.")) ref.value.customer[field.slice(9)] = value;
            else ref.value[field] = value;
          }
        }
      }
      return result;
    },
  };
  return { db, docs, pages: () => pages };
}

test("13 mois calendaires : années bissextiles et fin de mois", () => {
  assert.equal(retentionCutoff(reference).toISOString(), "2025-09-01T00:00:00.000Z");
  assert.equal(retentionCutoff(new Date("2025-03-31T12:34:00Z")).toISOString(), "2024-02-29T12:34:00.000Z");
  assert.equal(retentionCutoff(new Date("2026-03-31T12:34:00Z")).toISOString(), "2025-02-28T12:34:00.000Z");
  assert.throws(() => retentionCutoff(new Date("invalid")));
});
test("pagination au-delà de 500, limite stricte et préservation métier", async () => {
  const f = fixture(501);
  const before = JSON.stringify({ geo: f.docs[0].value.geo, projectDetails: f.docs[0].value.projectDetails });
  const result = await anonymizeExpiredLeads(f.db, reference);
  assert.equal(result.anonymized, 501);
  assert.equal(result.scanned, 501);
  assert.equal(f.pages(), 3);
  assert.ok(customerIsMasked(f.docs[0].value.customer));
  assert.equal(f.docs[0].value.customer.salutation, "madame");
  assert.equal(f.docs[0].value.status, "assigned");
  assert.equal(JSON.stringify({ geo: f.docs[0].value.geo, projectDetails: f.docs[0].value.projectDetails }), before);
  assert.equal(f.docs.find((doc) => doc.id === "boundary").value.customer.firstName, "Conservé");
  assert.equal(f.docs.find((doc) => doc.id === "missing-date").value.customer.firstName, "Sans date");
});
test("réexécution idempotente et reprise d'un masquage partiel", async () => {
  const f = fixture(3);
  f.docs[0].value.customer.firstName = "***";
  assert.equal((await anonymizeExpiredLeads(f.db, reference)).anonymized, 3);
  assert.equal((await anonymizeExpiredLeads(f.db, reference)).anonymized, 0);
});
test("aucun lead ancien : aucun document modifié", async () => {
  assert.equal((await anonymizeExpiredLeads(fixture(0).db, reference)).anonymized, 0);
});
test("erreur Firestore propagée pour permettre la reprise Scheduler", async () => {
  const f = fixture(1);
  f.db.runTransaction = async () => { throw new Error("Firestore indisponible"); };
  await assert.rejects(anonymizeExpiredLeads(f.db, reference), /Firestore indisponible/);
});
test("configuration mensuelle à 02 h Europe/Paris", () => {
  assert.equal(rgpdAnonymization.__endpoint.scheduleTrigger.schedule, "every 1 of month 02:00");
  assert.equal(rgpdAnonymization.__endpoint.scheduleTrigger.timeZone, "Europe/Paris");
});
