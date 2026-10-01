import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { refundDispute, notifyDisputeAdmin, DisputeError } from "../src/lib/disputes";
import { DisputeSchema, DISPUTE_WINDOW_MS } from "../src/types/dispute";
import { POST } from "../src/app/api/leads/dispute/route";

const now = 2_000_000_000_000;
const input = { leadId: "lead-1", reason: "fake_phone" as const, comment: "Le numéro n’est pas attribué." };
type Data = Record<string, any>;
type Ref = { path: string; update: (data: Data) => Promise<void> };
type Operation = { path: string; data: Data; create?: boolean };

// Double transactionnel : écritures différées/atomiques, callbacks rejoués,
// sérialisation des concurrents et rejet des lectures après écriture.
// Ne remplace pas un test d'intégration contre l'émulateur Firestore.
function database() {
  let store = new Map<string, Data>();
  let queue = Promise.resolve();
  let failCommit = false;
  const debitId = (partner: string) => createHash("sha256").update(JSON.stringify([input.leadId, partner])).digest("hex");
  store.set("leads/lead-1", { status: "assigned", assignedAt: Timestamp.fromMillis(now - 1000), assignedPartners: ["p1", "p2"] });
  for (const partner of ["p1", "p2"]) {
    store.set(`partners/${partner}`, { credits: 5 });
    store.set(`transactions/${debitId(partner)}`, { type: "debit_lead", leadId: "lead-1", partnerId: partner, amount: -1 });
  }
  function commit(operations: Operation[]) {
    if (failCommit) throw new Error("Échec de commit simulé");
    const next = new Map(store);
    for (const { path, data, create } of operations) {
      if (create && next.has(path)) throw new Error("Déjà créé");
      if (!create && !next.has(path)) throw new Error("Document absent");
      const updated = { ...next.get(path) };
      for (const [key, value] of Object.entries(data)) {
        if (!(value instanceof FieldValue)) { updated[key] = value; continue; }
        if (value.isEqual(FieldValue.increment(1))) updated[key] = (updated[key] ?? 0) + 1;
        else if (value.isEqual(FieldValue.serverTimestamp())) updated[key] = Timestamp.fromMillis(now);
        else if (value.isEqual(FieldValue.delete())) delete updated[key];
        else {
          const partner = ["p1", "p2"].find((id) => value.isEqual(FieldValue.arrayUnion(id)));
          assert.ok(partner, "Transformée connue");
          updated[key] = [...new Set([...(updated[key] ?? []), partner])];
        }
      }
      next.set(path, updated);
    }
    store = next;
  }
  const db = {
    collection: (collection: string) => ({ doc: (id: string): Ref => ({ path: `${collection}/${id}`, update: async (data) => commit([{ path: `${collection}/${id}`, data }]) }) }),
    runTransaction: <T,>(callback: (tx: any) => Promise<T>) => {
      const work = queue.then(async () => {
        let result!: T;
        // Simule une relance du callback Firestore : premier résultat abandonné.
        for (let iteration = 0; iteration < 2; iteration++) {
          const operations: Operation[] = [];
          result = await callback({
            get: async (ref: Ref) => {
              assert.equal(operations.length, 0, "Toutes les lectures doivent précéder les écritures");
              return { exists: store.has(ref.path), data: () => store.get(ref.path) };
            },
            update: (ref: Ref, data: Data) => operations.push({ path: ref.path, data }),
            create: (ref: Ref, data: Data) => operations.push({ path: ref.path, data, create: true }),
          });
          if (iteration === 1) commit(operations);
        }
        return result;
      });
      queue = work.then(() => {}, () => {});
      return work;
    },
  } as unknown as Firestore;
  return { db, get: (path: string) => store.get(path), set: (path: string, value: Data) => store.set(path, value),
    removeDebit: () => store.delete(`transactions/${debitId("p1")}`), fail: () => { failCommit = true; } };
}

test("schéma strict : motif inconnu, commentaire vide, champs injectés refusés", () => {
  for (const body of [{ ...input, reason: "other" }, { ...input, comment: "   " }, { ...input, partnerId: "p2" }, { ...input, comment: "x".repeat(2001) }]) {
    assert.equal(DisputeSchema.safeParse(body).success, false);
  }
});

test("route : connexion obligatoire", async () => {
  const response = await POST(new Request("https://example.com/api/leads/dispute", { method: "POST" }));
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("48 heures strictes et dates invalides", async () => {
  for (const assignedAt of [Timestamp.fromMillis(now - DISPUTE_WINDOW_MS), Timestamp.fromMillis(now + 1), null]) {
    const fixture = database();
    fixture.set("leads/lead-1", { ...fixture.get("leads/lead-1"), assignedAt });
    await assert.rejects(refundDispute(fixture.db, "p1", input, () => now), (error: unknown) => error instanceof DisputeError && error.status === 409);
    assert.equal(fixture.get("partners/p1")?.credits, 5);
  }
  const fixture = database();
  fixture.set("leads/lead-1", { ...fixture.get("leads/lead-1"), assignedAt: Timestamp.fromMillis(now - DISPUTE_WINDOW_MS + 1) });
  assert.equal((await refundDispute(fixture.db, "p1", input, () => now)).alreadyRefunded, false);
});

test("partenaire non assigné et absence de débit : aucun remboursement", async () => {
  const fixture = database();
  await assert.rejects(refundDispute(fixture.db, "intrus", input, () => now), (error: unknown) => error instanceof DisputeError && error.status === 403);
  fixture.removeDebit();
  await assert.rejects(refundDispute(fixture.db, "p1", input, () => now), (error: unknown) => error instanceof DisputeError && error.status === 409);
  assert.equal(fixture.get("partners/p1")?.credits, 5);
});

test("appels concurrents, callback rejoué et répétition après expiration : un seul crédit", async () => {
  const fixture = database();
  const results = await Promise.all(Array.from({ length: 5 }, () => refundDispute(fixture.db, "p1", input, () => now)));
  assert.equal(results.filter((item) => !item.alreadyRefunded).length, 1);
  assert.equal(fixture.get("partners/p1")?.credits, 6);
  assert.equal(fixture.get("leads/lead-1")?.status, "disputed");
  assert.equal(fixture.get(`transactions/${results[0].refundId}`)?.type, "refund_dispute");
  assert.equal(fixture.get(`adminNotifications/${results[0].refundId}`)?.status, "pending");
  assert.equal((await refundDispute(fixture.db, "p1", input, () => now + DISPUTE_WINDOW_MS)).alreadyRefunded, true);
  assert.equal(fixture.get("partners/p1")?.credits, 6);
});

test("le second partenaire peut contester indépendamment", async () => {
  const fixture = database();
  await Promise.all(["p1", "p2"].map((id) => refundDispute(fixture.db, id, input, () => now)));
  assert.equal(fixture.get("partners/p1")?.credits, 6);
  assert.equal(fixture.get("partners/p2")?.credits, 6);
  assert.deepEqual(fixture.get("leads/lead-1")?.disputedPartners, ["p1", "p2"]);
});

test("commit échoué : ni crédit, ni modification du lead", async () => {
  const fixture = database();
  fixture.fail();
  await assert.rejects(refundDispute(fixture.db, "p1", input, () => now));
  assert.equal(fixture.get("partners/p1")?.credits, 5);
  assert.equal(fixture.get("leads/lead-1")?.status, "assigned");
});

test("webhook en échec puis reprise : remboursement conservé, alerte dédupliquée", async () => {
  const fixture = database();
  const { refundId } = await refundDispute(fixture.db, "p1", input, () => now);
  let calls = 0;
  const fetchImpl: typeof fetch = async (_url, options) => {
    calls++;
    assert.equal((options?.headers as Record<string, string>)["Idempotency-Key"], refundId);
    const payload = JSON.parse(options?.body as string);
    assert.equal(payload.reason, "fake_phone");
    return new Response(null, { status: calls === 1 ? 503 : 204 });
  };
  const options = { webhook: "https://alerts.example.com/dispute", fetchImpl, now: () => now };
  await notifyDisputeAdmin(fixture.db, refundId, options);
  assert.equal(fixture.get(`adminNotifications/${refundId}`)?.status, "pending");
  assert.equal(fixture.get("partners/p1")?.credits, 6);
  await notifyDisputeAdmin(fixture.db, refundId, options);
  await notifyDisputeAdmin(fixture.db, refundId, options);
  assert.equal(calls, 2);
  assert.equal(fixture.get(`adminNotifications/${refundId}`)?.status, "sent");
});
