import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { assignLead, AssignmentError } from "../src/lib/assign-lead";

async function main() {
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
  const app = initializeApp({ projectId: "demo-leads-engine" }, "assign-tests");
  const db = getFirestore(app);
  const prefix = `assign_${Date.now()}`;
  const lead = { vertical: "demenagement", status: "pending", geo: { departurePostalCode: "78000" }, customer: { phone: "0600000000" } };
  const partner = { vertical: "demenagement", assignedDepartments: ["78"], isActive: true, credits: 5 };
  const put = async (collection: string, id: string, data: object) => { await db.collection(collection).doc(id).set(data); return id; };
  const balance = async (id: string) => (await db.collection("partners").doc(id).get()).data()!.credits;
  const reject = (operation: Promise<unknown>) => assert.rejects(operation, (error) => error instanceof AssignmentError && error.status === 409);
  try {
    const p = await put("partners", `${prefix}_p`, partner);
    const l = await put("leads", `${prefix}_lead`, lead);
    const repeated = await Promise.all([assignLead(db, l, p, "admin"), assignLead(db, l, p, "admin")]);
    assert.equal(repeated.filter((result) => result.alreadyAssigned).length, 1);
    assert.equal(await balance(p), 4);
    assert.equal((await db.collection("transactions").where("leadId", "==", l).get()).size, 1);

    const scarce = await put("partners", `${prefix}_scarce`, { ...partner, credits: 1 });
    const l1 = await put("leads", `${prefix}_one`, lead), l2 = await put("leads", `${prefix}_two`, lead);
    const race = await Promise.allSettled([assignLead(db, l1, scarce, "admin"), assignLead(db, l2, scarce, "admin")]);
    assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(await balance(scarce), 0);

    const capped = await put("leads", `${prefix}_cap`, lead);
    const candidates = await Promise.all([1, 2, 3].map((i) => put("partners", `${prefix}_cap${i}`, partner)));
    const capRace = await Promise.allSettled(candidates.map((id) => assignLead(db, capped, id, "admin")));
    assert.equal(capRace.filter((result) => result.status === "fulfilled").length, 2);
    assert.equal((await db.collection("leads").doc(capped).get()).data()!.assignedPartners.length, 2);
    assert.equal((await Promise.all(candidates.map(balance))).reduce((sum, credits) => sum + credits, 0), 13);
    assert.equal((await db.collection("transactions").where("leadId", "==", capped).get()).size, 2);

    for (const [suffix, changes] of Object.entries({ zone: { assignedDepartments: ["75"] }, inactive: { isActive: false }, vertical: { vertical: "renovation" }, empty: { credits: 0 } })) {
      const incompatible = await put("partners", `${prefix}_${suffix}`, { ...partner, ...changes });
      const untouched = await put("leads", `${prefix}_invalid_${suffix}`, lead);
      await reject(assignLead(db, untouched, incompatible, "admin"));
      assert.equal((await db.collection("leads").doc(untouched).get()).data()!.status, "pending");
      assert.equal((await db.collection("transactions").where("leadId", "==", untouched).get()).size, 0);
    }
    const unavailable = await put("leads", `${prefix}_unassigned`, { ...lead, status: "unassigned" });
    await assignLead(db, unavailable, p, "admin");
    const disputed = await put("leads", `${prefix}_disputed`, { ...lead, status: "disputed" });
    await reject(assignLead(db, disputed, p, "admin"));
    console.log("Attributions : répétitions, concurrence, limite de 2, solde et éligibilité validés.");
  } finally { await db.terminate(); await deleteApp(app); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
