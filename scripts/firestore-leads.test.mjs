import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, addDoc, collection, doc, getDoc, getDocs, query, where, updateDoc, deleteDoc, serverTimestamp, terminate, setLogLevel } from "firebase/firestore";
import { initializeApp as initializeAdmin, deleteApp as deleteAdmin } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";

// Tests isolés : uniquement l'émulateur, jamais une base réelle.
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8085";
const projectId = "demo-leads-engine";
setLogLevel("silent");
const app = initializeApp({ projectId, apiKey: "test", appId: "test" }, "rules-test");
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8085);
const partnerApp = initializeApp({ projectId, apiKey: "test", appId: "test" }, "partner-test");
const partnerDb = getFirestore(partnerApp);
connectFirestoreEmulator(partnerDb, "127.0.0.1", 8085, { mockUserToken: { sub: "partner-test" } });
const admin = initializeAdmin({ projectId }, "rules-admin");
const adminDb = getAdminFirestore(admin);
const denied = (operation) => assert.rejects(operation, (error) => error.code === "permission-denied");
const customer = { firstName: "Test", lastName: "Emulateur", phone: "0600000000", email: "test@example.com" };
const moving = {
  vertical: "demenagement", status: "pending", createdAt: serverTimestamp(), customer,
  geo: { departureCity: "Versailles", departurePostalCode: "78000", arrivalCity: "Paris", arrivalPostalCode: "75001" },
  projectDetails: { housingType: "maison", surface: 80, departureFloor: 0, arrivalFloor: 2, departureElevator: false, arrivalElevator: true, targetDate: "2026-12-01" },
};
const renovation = {
  vertical: "renovation", status: "pending", createdAt: serverTimestamp(), customer: { ...customer, salutation: "madame" },
  geo: { departureCity: "Versailles", departurePostalCode: "78000" }, projectType: "cuisine", budgetBracket: "10k-30k",
  property: { occupancyStatus: "proprietaire_occupant", surface: 20, buildingType: "appartement" },
};
try {
  const movingRef = await addDoc(collection(db, "leads"), moving);
  await addDoc(collection(db, "leads"), renovation);
  for (const invalid of [
    { ...renovation, status: "assigned" },
    { ...renovation, assignedPartners: ["partner-test"] },
    { ...renovation, customer: { ...renovation.customer, phone: "0123456789" } },
    { ...renovation, property: { ...renovation.property, occupancyStatus: "locataire" } },
    { ...renovation, property: { ...renovation.property, surface: 0 } },
    { ...renovation, createdAt: new Date(0) },
    { ...renovation, geo: { ...renovation.geo, departurePostalCode: "123" } },
    { ...renovation, customer: { ...renovation.customer, credits: 100 } },
    { ...moving, projectDetails: { ...moving.projectDetails, surface: 8 } },
  ]) await denied(addDoc(collection(db, "leads"), invalid));
  const { geo, ...withoutGeo } = renovation;
  await denied(addDoc(collection(db, "leads"), withoutGeo));
  await denied(getDoc(movingRef));
  await denied(getDocs(collection(db, "leads")));
  await denied(updateDoc(movingRef, { status: "assigned" }));
  await denied(deleteDoc(movingRef));
  await adminDb.doc(`leads/${movingRef.id}`).update({ assignedPartners: ["partner-test"] });
  assert.equal((await getDoc(doc(partnerDb, "leads", movingRef.id))).exists(), true);
  assert.equal((await getDocs(query(collection(partnerDb, "leads"), where("assignedPartners", "array-contains", "partner-test")))).size, 1);
  await denied(getDocs(collection(partnerDb, "leads")));
  await adminDb.doc("partners/partner-test").set({ credits: 5, displayName: "Test" });
  await denied(updateDoc(doc(partnerDb, "partners", "partner-test"), { credits: 100 }));
  console.log("Règles validées : créations des deux métiers, rejet des champs réservés et données invalides, lectures privées, crédits protégés.");
} finally {
  await Promise.all([terminate(db), terminate(partnerDb), adminDb.terminate()]);
  await Promise.all([deleteApp(app), deleteApp(partnerApp), deleteAdmin(admin)]);
}
