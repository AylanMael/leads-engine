import { randomUUID } from "node:crypto";
import { LeadDemenagementSchema } from "../../../types/lead";
import { LeadRenovationSchema } from "../../../types/lead-renovation";
import { localError, localResponse, withLocalStore } from "../../../lib/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = LeadDemenagementSchema.or(LeadRenovationSchema);

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return localResponse({ error: "Not found" }, 404);
  try {
    const partnerId = new URL(request.url).searchParams.get("partnerId");
    return localResponse(await withLocalStore(({ leads }) => leads
      .filter((lead) => !partnerId || lead.assignedPartners?.includes(partnerId))
      .sort((a, b) => (partnerId ? b.assignedAt ?? b.createdAt : b.createdAt).localeCompare(partnerId ? a.assignedAt ?? a.createdAt : a.createdAt))));
  } catch (error) { return localError(error); }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") return localResponse({ error: "Not found" }, 404);
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return localResponse({ error: "JSON invalide." }, 400); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return localResponse({ error: "Les informations du lead sont invalides." }, 400);
  try {
    const id = randomUUID();
    await withLocalStore(({ leads }) => {
      leads.push({ ...parsed.data, id, createdAt: new Date().toISOString(), status: "pending" });
    }, true);
    return localResponse({ success: true, id }, 201);
  } catch (error) { return localError(error); }
}
