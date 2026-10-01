import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import { DISPUTE_WINDOW_MS, DisputeSchema, type DisputeInput } from "../types/dispute";

export class DisputeError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Un remboursement par couple lead/partenaire, garanti par la même transaction. */
export async function refundDispute(db: Firestore, partnerId: string, input: DisputeInput, now = Date.now) {
  const parsed = DisputeSchema.safeParse(input);
  if (!parsed.success) throw new DisputeError(400, "Motif ou commentaire invalide.");
  const { leadId, reason, comment } = parsed.data;
  // Même identifiant que le débit d'onLeadCreated, avec un préfixe pour le remboursement.
  const debitId = createHash("sha256").update(JSON.stringify([leadId, partnerId])).digest("hex");
  const refundId = `refund_dispute_${debitId}`;
  const leadRef = db.collection("leads").doc(leadId);
  const partnerRef = db.collection("partners").doc(partnerId);
  const refundRef = db.collection("transactions").doc(refundId);

  return db.runTransaction(async (tx) => {
    const leadSnapshot = await tx.get(leadRef);
    const lead = leadSnapshot.data();
    // Ne révèle pas l'existence d'un lead aux partenaires non assignés.
    if (!lead || !Array.isArray(lead.assignedPartners) || !lead.assignedPartners.includes(partnerId)) {
      throw new DisputeError(403, "Cette demande ne vous est pas attribuée.");
    }
    const partnerSnapshot = await tx.get(partnerRef);
    if (!partnerSnapshot.exists) throw new DisputeError(403, "Profil partenaire requis.");
    const refundSnapshot = await tx.get(refundRef);
    if (refundSnapshot.exists) {
      const refund = refundSnapshot.data()!;
      if (refund.type !== "refund_dispute" || refund.partnerId !== partnerId || refund.leadId !== leadId) {
        throw new DisputeError(409, "Historique incohérent. Contactez l’administrateur.");
      }
      // Rejouer une réponse perdue reste sans effet, même après les 48 h.
      return { refundId, alreadyRefunded: true };
    }
    if (!(lead.assignedAt instanceof Timestamp)) throw new DisputeError(409, "Date d’attribution indisponible.");
    const age = now() - lead.assignedAt.toMillis();
    if (age < 0) throw new DisputeError(409, "Date d’attribution incohérente.");
    if (age >= DISPUTE_WINDOW_MS) throw new DisputeError(409, "Le délai de contestation de 48 heures est dépassé.");
    if (!["assigned", "disputed"].includes(lead.status) || lead.disputedPartners?.includes(partnerId)) {
      throw new DisputeError(409, "Cette demande ne peut plus être contestée.");
    }
    const credits = partnerSnapshot.data()?.credits;
    if (!Number.isSafeInteger(credits) || credits < 0 || credits >= Number.MAX_SAFE_INTEGER) {
      throw new DisputeError(409, "Solde invalide. Contactez l’administrateur.");
    }
    const debit = (await tx.get(db.collection("transactions").doc(debitId))).data();
    if (!debit || debit.type !== "debit_lead" || debit.amount !== -1 || debit.partnerId !== partnerId || debit.leadId !== leadId) {
      throw new DisputeError(409, "Aucun débit correspondant à rembourser. Contactez l’administrateur.");
    }

    // Toutes les lectures précèdent les écritures. Aucun appel réseau dans le callback.
    tx.update(partnerRef, { credits: FieldValue.increment(1) });
    tx.update(leadRef, {
      status: "disputed", disputedPartners: FieldValue.arrayUnion(partnerId),
      disputedAt: FieldValue.serverTimestamp(),
    });
    tx.create(refundRef, {
      type: "refund_dispute", leadId, partnerId, reason, comment, amount: 1,
      debitTransactionId: debitId, createdAt: FieldValue.serverTimestamp(),
    });
    // File privée persistée avec le recrédit : l'alerte survit à une panne réseau.
    tx.create(db.collection("adminNotifications").doc(refundId), {
      type: "lead_disputed", leadId, partnerId, reason, comment,
      status: "pending", attempts: 0, createdAt: FieldValue.serverTimestamp(),
    });
    return { refundId, alreadyRefunded: false };
  });
}

/** Alerte après commit. Les répétitions peuvent reprendre un envoi échoué sans recréditer. */
export async function notifyDisputeAdmin(db: Firestore, refundId: string, {
  webhook = process.env.ADMIN_DISPUTE_WEBHOOK_URL,
  fetchImpl = fetch,
  now = Date.now,
}: { webhook?: string; fetchImpl?: typeof fetch; now?: () => number } = {}): Promise<void> {
  const ref = db.collection("adminNotifications").doc(refundId);
  try {
    if (!webhook) { console.error("Alerte contestation en attente : webhook non configuré", { refundId }); return; }
    const url = new URL(webhook);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Webhook invalide");
    const event = await db.runTransaction(async (tx) => {
      const item = (await tx.get(ref)).data();
      if (!item || item.status === "sent" || (item.leaseUntil instanceof Timestamp && item.leaseUntil.toMillis() > now())) return null;
      tx.update(ref, { status: "sending", attempts: FieldValue.increment(1), leaseUntil: Timestamp.fromMillis(now() + 30_000) });
      return { eventId: refundId, type: "lead_disputed", leadId: item.leadId, partnerId: item.partnerId, reason: item.reason, comment: item.comment };
    });
    if (!event) return;
    try {
      const response = await fetchImpl(url, {
        method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": refundId },
        body: JSON.stringify(event), signal: AbortSignal.timeout(5000), redirect: "error",
      });
      if (!response.ok) throw new Error("Webhook indisponible");
      await ref.update({ status: "sent", sentAt: FieldValue.serverTimestamp(), leaseUntil: FieldValue.delete() });
    } catch {
      await ref.update({ status: "pending", leaseUntil: FieldValue.delete(), lastFailedAt: FieldValue.serverTimestamp() });
      console.error("Alerte contestation à réessayer", { refundId });
    }
  } catch {
    // Le remboursement déjà validé reste acquis même si l'alerte échoue.
    console.error("Alerte contestation indisponible", { refundId });
  }
}
