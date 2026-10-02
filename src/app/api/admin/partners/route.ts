import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { requireAdmin, adminResponse, adminFailure, AdminError } from "../../../../lib/admin-request";

export const runtime = "nodejs";
const schema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  companyName: z.string().trim().min(2).max(150),
  vertical: z.enum(["demenagement", "renovation"]),
  assignedDepartments: z.array(z.string().regex(/^(?:\d{2}|2[AB]|97\d)$/)).min(1).max(20),
  credits: z.number().int().min(0).max(1000),
}).strict();
export async function POST(request: Request) {
  try {
    const actorId = await requireAdmin(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AdminError(400, "Informations partenaire invalides.");
    const input = parsed.data;
    const auth = getAdminAuth();
    let user;
    try { user = await auth.getUserByEmail(input.email); }
    catch (error) {
      if ((error as { code?: string }).code !== "auth/user-not-found") throw error;
      try { user = await auth.createUser({ email: input.email, displayName: input.companyName }); }
      catch (creationError) {
        if ((creationError as { code?: string }).code !== "auth/email-already-exists") throw creationError;
        user = await auth.getUserByEmail(input.email);
      }
    }
    if (user.disabled) throw new AdminError(409, "Ce compte Firebase est désactivé.");
    const db = getAdminDb(), partnerRef = db.collection("partners").doc(user.uid);
    const created = await db.runTransaction(async (tx) => {
      if ((await tx.get(partnerRef)).exists) return false;
      tx.create(partnerRef, { ...input, assignedDepartments: [...new Set(input.assignedDepartments)],
        isActive: true, createdAt: FieldValue.serverTimestamp(), createdBy: actorId });
      if (input.credits > 0) tx.create(db.collection("transactions").doc(`initial_${user.uid}`), {
        type: "credit_initial", amount: input.credits, partnerId: user.uid, actorId,
        createdAt: FieldValue.serverTimestamp() });
      return true;
    });
    // Retrying after an interrupted request never overwrites the profile or adds credits twice.
    return adminResponse({ success: true, id: user.uid, created }, created ? 201 : 200);
  } catch (error) { return adminFailure(error); }
}
