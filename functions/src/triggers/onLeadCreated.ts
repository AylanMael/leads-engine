import { createHash } from "node:crypto";
import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { notifyLeadAssignment } from "../services/notifications";

const app = getApps().some((app) => app.name === "[DEFAULT]")
  ? getApp()
  : initializeApp();
const db = getFirestore(app);

/** Attribution et facturation atomiques, y compris en cas de livraison répétée. */
export const onLeadCreated = onDocumentCreated("leads/{leadId}", async (event) => {
  if (!event.data) return;
  const leadRef = event.data.ref;

  const assignment = await db.runTransaction(async (transaction) => {
    // Relire l'état actuel, et non le snapshot initial d'un événement rejoué.
    const snapshot = await transaction.get(leadRef);
    if (!snapshot.exists) return;
    const lead = snapshot.data()!;
    if (lead.status !== undefined && lead.status !== "pending") return;

    const vertical = lead.vertical;
    const postalCode = lead.geo?.departurePostalCode;
    if (
      (vertical !== "demenagement" && vertical !== "renovation") ||
      typeof postalCode !== "string" || !/^[0-9]{5}$/.test(postalCode)
    ) {
      // Le contrat rénovation actuel n'inclut pas encore de géographie.
      transaction.update(leadRef, {
        status: "unassigned",
        assignedPartners: [],
        unassignedReason: "invalid_routing_criteria",
      });
      return;
    }

    // Convention demandée : les deux premiers chiffres du code postal.
    const depCode = postalCode.substring(0, 2);
    const eligiblePartners = db.collection("partners")
      .where("vertical", "==", vertical)
      .where("assignedDepartments", "array-contains", depCode)
      .where("isActive", "==", true)
      .where("credits", ">=", 1)
      .limit(2);

    // La requête fait partie de la transaction : les crédits lus sont protégés
    // contre deux leads concurrents. Toutes les lectures précèdent les écritures.
    const partners = await transaction.get(eligiblePartners);
    if (partners.empty) {
      transaction.update(leadRef, {
        status: "unassigned",
        assignedPartners: [],
        unassignedReason: "no_eligible_partner",
      });
      return;
    }

    for (const partner of partners.docs) {
      // Une référence stable évite de créer deux audits pour un même couple.
      const auditId = createHash("sha256")
        .update(JSON.stringify([leadRef.id, partner.id]))
        .digest("hex");
      transaction.update(partner.ref, { credits: FieldValue.increment(-1) });
      transaction.create(db.collection("transactions").doc(auditId), {
        type: "debit_lead",
        leadId: leadRef.id,
        partnerId: partner.id,
        vertical,
        departmentCode: depCode,
        amount: -1,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    transaction.update(leadRef, {
      status: "assigned",
      assignedPartners: partners.docs.map((partner) => partner.id),
      assignedAt: FieldValue.serverTimestamp(),
    });
    return {
      lead,
      partners: partners.docs.map((partner) => ({
        id: partner.id,
        email: partner.data().email,
        phone: partner.data().phone,
      })),
    };
  });

  // Aucun appel externe dans la transaction, qui peut être réexécutée par Firestore.
  if (assignment) {
    try {
      await notifyLeadAssignment(leadRef.id, assignment.lead, assignment.partners);
    } catch {
      console.error("Notifications indisponibles après attribution", { leadId: leadRef.id });
    }
  }
});
