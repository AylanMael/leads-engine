import { z } from "zod";
import { LocalStoreError, localError, localResponse, withLocalStore } from "../../../lib/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const rechargeSchema = z.object({ partnerId: z.string().min(1), credits: z.literal(5).default(5) }).strict();

export async function GET() {
  if (process.env.NODE_ENV !== "development") return localResponse({ error: "Not found" }, 404);
  try { return localResponse(await withLocalStore(({ partners }) => partners)); }
  catch (error) { return localError(error); }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return localResponse({ error: "Not found" }, 404);
  let body: unknown;
  try { body = await request.json(); }
  catch { return localResponse({ error: "JSON invalide." }, 400); }
  const parsed = rechargeSchema.safeParse(body);
  if (!parsed.success) return localResponse({ error: "Choisissez un partenaire et le pack de 5 crédits." }, 400);
  try {
    const partner = await withLocalStore(({ partners }) => {
      const partner = partners.find(({ id }) => id === parsed.data.partnerId);
      if (!partner) throw new LocalStoreError("Partenaire introuvable.", 404);
      if (!Number.isSafeInteger(partner.credits) || partner.credits < 0 || !Number.isSafeInteger(partner.credits + 5)) throw new LocalStoreError("Solde invalide.", 409);
      partner.credits += 5;
      return partner;
    }, true);
    return localResponse({ success: true, partner });
  } catch (error) { return localError(error); }
}
