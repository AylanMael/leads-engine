import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { DisputeError, notifyDisputeAdmin, refundDispute } from "../../../../lib/disputes";
import { DisputeSchema } from "../../../../types/dispute";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: "Connexion requise." }, 401);
  let uid: string;
  try { uid = (await getAdminAuth().verifyIdToken(token, true)).uid; }
  catch { return json({ error: "Session invalide ou expirée." }, 401); }

  let body: unknown;
  try {
    // Borne aussi les requêtes sans Content-Length (transfert chunked).
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Requête vide." }, 400);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_384) { await reader.cancel(); return json({ error: "Requête trop volumineuse." }, 413); }
      chunks.push(chunk.value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { return json({ error: "Requête invalide." }, 400); }
  const parsed = DisputeSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Choisissez un motif valide et expliquez le problème (2 000 caractères maximum)." }, 400);

  try {
    const db = getAdminDb();
    const result = await refundDispute(db, uid, parsed.data);
    await notifyDisputeAdmin(db, result.refundId);
    return json({ success: true, ...result });
  } catch (error) {
    if (error instanceof DisputeError) return json({ error: error.message }, error.status);
    console.error("Échec de la transaction de contestation");
    return json({ error: "La contestation n’a pas pu être confirmée. Vous pouvez réessayer sans risque de double remboursement." }, 503);
  }
}
