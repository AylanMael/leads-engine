import { FieldValue } from "firebase-admin/firestore";
import { CREDIT_PACKS } from "../../../../config/credit-packs";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { getCheckoutOrigin, getStripe } from "../../../../lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return Response.json({ error: "Connexion requise." }, { status: 401 });
  let uid: string;
  try {
    uid = (await getAdminAuth().verifyIdToken(token, true)).uid;
  } catch {
    return Response.json({ error: "Session invalide ou expirée." }, { status: 401 });
  }
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Requête invalide." }, { status: 400 }); }
  const packId = body && typeof body === "object" && "packId" in body ? body.packId : undefined;
  const pack = CREDIT_PACKS.find((item) => item.id === packId);
  if (!pack) return Response.json({ error: "Pack inconnu." }, { status: 400 });

  try {
    const db = getAdminDb();
    const partner = await db.collection("partners").doc(uid).get();
    const vertical = partner.data()?.vertical;
    if (!partner.exists || (vertical !== "demenagement" && vertical !== "renovation")) {
      return Response.json({ error: "Profil partenaire requis." }, { status: 403 });
    }
    const origin = getCheckoutOrigin();
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      client_reference_id: uid,
      metadata: { partnerId: uid, vertical, credits: String(pack.credits), packId: pack.id },
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "eur", unit_amount: pack.amount, tax_behavior: "exclusive",
          product_data: { name: `${pack.credits} crédits leads — ${vertical}` },
        },
      }],
      automatic_tax: { enabled: true },
      billing_address_collection: "required",
      success_url: `${origin}/partenaire?success=true`,
      cancel_url: `${origin}/partenaire?canceled=true`,
    });
    if (!session.url) throw new Error("URL Checkout absente");
    // Fige le catalogue pour cet achat, même si les tarifs changent ensuite.
    await db.collection("stripeCheckouts").doc(session.id).create({
      partnerId: uid, vertical, credits: pack.credits, packId: pack.id,
      amount: pack.amount, currency: "eur", status: "pending", createdAt: FieldValue.serverTimestamp(),
    });
    return Response.json({ url: session.url }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Échec de création Checkout");
    return Response.json({ error: "Paiement indisponible. Veuillez réessayer." }, { status: 500 });
  }
}
