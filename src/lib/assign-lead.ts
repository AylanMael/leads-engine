import { createHash } from "node:crypto";
import { FieldValue, type Firestore } from "firebase-admin/firestore";

export class AssignmentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** One debit per lead/partner pair, including simultaneous or repeated requests. */
export async function assignLead(db: Firestore, leadId: string, partnerId: string, actorId: string) {
  const leadRef = db.collection("leads").doc(leadId);
  const partnerRef = db.collection("partners").doc(partnerId);
  // Same audit key as the automatic router and refund service.
  const auditId = createHash("sha256").update(JSON.stringify([leadId, partnerId])).digest("hex");
  const auditRef = db.collection("transactions").doc(auditId);
  return db.runTransaction(async (tx) => {
    const [leadSnapshot, partnerSnapshot, auditSnapshot] = await tx.getAll(leadRef, partnerRef, auditRef);
    const lead = leadSnapshot.data(), partner = partnerSnapshot.data();
    if (!lead || !partner) throw new AssignmentError(404, "Demande ou partenaire introuvable.");
    const assigned: string[] = lead.assignedPartners ?? [];
    if (!Array.isArray(assigned)) throw new AssignmentError(409, "Historique d’attribution invalide.");
    if (assigned.includes(partnerId)) return { success: true, alreadyAssigned: true };
    if (auditSnapshot.exists) throw new AssignmentError(409, "Un débit existe déjà pour cette attribution.");
    if (!["pending", "unassigned", "assigned"].includes(lead.status) || lead.customer?.phone === "***") {
      throw new AssignmentError(409, "Cette demande ne peut pas être attribuée.");
    }
    if (assigned.length >= 2) throw new AssignmentError(409, "Deux partenaires sont déjà attribués.");
    const postalCode = lead.geo?.departurePostalCode;
    const department = typeof postalCode === "string" && /^\d{5}$/.test(postalCode) ? postalCode.slice(0, 2) : null;
    if (!department || partner.vertical !== lead.vertical || partner.isActive !== true
      || !Array.isArray(partner.assignedDepartments) || !partner.assignedDepartments.includes(department)) {
      throw new AssignmentError(409, "Partenaire inactif ou incompatible avec le métier et le département.");
    }
    if (!Number.isSafeInteger(partner.credits) || partner.credits < 1) throw new AssignmentError(409, "Ce partenaire n’a plus de crédits.");
    tx.update(partnerRef, { credits: FieldValue.increment(-1) });
    tx.create(auditRef, { type: "debit_lead", amount: -1, leadId, partnerId,
      vertical: lead.vertical, departmentCode: department, actorId, source: "admin",
      createdAt: FieldValue.serverTimestamp() });
    tx.update(leadRef, { status: "assigned", assignedPartners: [...assigned, partnerId],
      // Preserve the first assignment's date (notably the dispute deadline).
      assignedAt: lead.assignedAt ?? FieldValue.serverTimestamp(),
      [`partnerAssignedAt.${partnerId}`]: FieldValue.serverTimestamp(),
      unassignedReason: FieldValue.delete() });
    return { success: true, alreadyAssigned: false };
  });
}
