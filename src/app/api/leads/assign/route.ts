import { z } from "zod";
import { LocalStoreError, localError, localResponse, withLocalStore } from "../../../../lib/local-store";

export const runtime = "nodejs";
const assignmentSchema = z.object({ leadId: z.string().min(1), partnerId: z.string().min(1) }).strict();

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return localResponse({ error: "Not found" }, 404);
  let body: unknown;
  try { body = await request.json(); }
  catch { return localResponse({ error: "JSON invalide." }, 400); }
  const parsed = assignmentSchema.safeParse(body);
  if (!parsed.success) return localResponse({ error: "Lead et partenaire requis." }, 400);
  try {
    const result = await withLocalStore(({ leads, partners }) => {
      const lead = leads.find(({ id }) => id === parsed.data.leadId);
      const partner = partners.find(({ id }) => id === parsed.data.partnerId);
      if (!lead || !partner) throw new LocalStoreError("Lead ou partenaire introuvable.", 404);
      if (lead.assignedPartners?.includes(partner.id)) return { success: true, alreadyAssigned: true };
      if (lead.status !== "pending" || lead.assignedPartners?.length) throw new LocalStoreError("Ce lead est déjà attribué.", 409);
      if (lead.vertical !== partner.vertical || lead.geo?.departurePostalCode.slice(0, 2) !== partner.department) throw new LocalStoreError("Le métier ou le département ne correspond pas à ce partenaire.", 409);
      if (!Number.isSafeInteger(partner.credits) || partner.credits < 1) throw new LocalStoreError("Le partenaire n’a plus de crédits. Rechargez son solde.", 409);
      partner.credits -= 1;
      lead.status = "assigned";
      lead.assignedPartners = [partner.id];
      lead.assignedAt = new Date().toISOString();
      return { success: true, alreadyAssigned: false };
    }, true);
    return localResponse(result);
  } catch (error) { return localError(error); }
}
