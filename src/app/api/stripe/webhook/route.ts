import type Stripe from "stripe";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../../../lib/firebase-admin";
import { getStripe } from "../../../../lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: "Webhook non configuré." }, { status: 503 });
  if (!signature) return Response.json({ error: "Signature manquante." }, { status: 400 });
  let event: Stripe.Event;
  try {
    // Le corps brut doit rester intact pour vérifier la signature Stripe.
    event = getStripe().webhooks.constructEvent(await request.text(), signature, secret);
  } catch {
    return Response.json({ error: "Signature ou événement invalide." }, { status: 400 });
  }
  if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") {
    return Response.json({ received: true });
  }
  const session = event.data.object as Stripe.Checkout.Session;
  if (session.mode !== "payment" || session.payment_status !== "paid") return Response.json({ received: true });
  const partnerId = session.metadata?.partnerId;
  const credits = Number(session.metadata?.credits);
  if (!partnerId || partnerId.includes("/") || !Number.isSafeInteger(credits) || credits <= 0 || !/^cs_[a-zA-Z0-9_]+$/.test(session.id)) {
    return Response.json({ error: "Métadonnées invalides." }, { status: 400 });
  }
  try {
    const db = getAdminDb();
    const orderRef = db.collection("stripeCheckouts").doc(session.id);
    const auditRef = db.collection("transactions").doc(`stripe_${session.id}`);
    const partnerRef = db.collection("partners").doc(partnerId);
    await db.runTransaction(async (transaction) => {
      const [order, audit, partner] = await transaction.getAll(orderRef, auditRef, partnerRef);
      if (audit.exists) return; // Idempotence par achat, même pour deux événements distincts.
      const expected = order.data();
      if (!order.exists || !partner.exists || !expected || expected.status !== "pending" ||
          expected.partnerId !== partnerId || expected.credits !== credits ||
          expected.vertical !== session.metadata?.vertical || expected.packId !== session.metadata?.packId ||
          session.client_reference_id !== partnerId || expected.currency !== session.currency ||
          expected.amount !== session.amount_subtotal) throw new Error("Achat incohérent");
      const balance = partner.data()?.credits;
      if (!Number.isSafeInteger(balance) || balance < 0 || !Number.isSafeInteger(balance + credits)) throw new Error("Solde invalide");
      transaction.update(partnerRef, { credits: FieldValue.increment(credits) });
      transaction.create(auditRef, {
        type: "credit_recharge", partnerId, vertical: expected.vertical,
        amount: credits, stripeSessionId: session.id, stripeEventId: event.id,
        amountPaid: session.amount_total, currency: session.currency,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(orderRef, { status: "paid", paidAt: FieldValue.serverTimestamp() });
    });
    return Response.json({ received: true });
  } catch {
    console.error("Échec de recharge Stripe", { eventId: event.id });
    // Stripe pourra relivrer l'événement ; aucune écriture partielle n'est validée.
    return Response.json({ error: "Recharge non traitée." }, { status: 500 });
  }
}
