import { z } from "zod";
import { getAdminDb } from "../../../../../lib/firebase-admin";
import { requireAdmin, adminResponse, adminFailure, AdminError } from "../../../../../lib/admin-request";
import { assignLead, AssignmentError } from "../../../../../lib/assign-lead";

export const runtime = "nodejs";
const id = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const schema = z.object({ leadId: id, partnerId: id }).strict();
export async function POST(request: Request) {
  try {
    const actorId = await requireAdmin(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AdminError(400, "Identifiants invalides.");
    return adminResponse(await assignLead(getAdminDb(), parsed.data.leadId, parsed.data.partnerId, actorId));
  } catch (error) {
    if (error instanceof AssignmentError) return adminResponse({ error: error.message }, error.status);
    return adminFailure(error);
  }
}
