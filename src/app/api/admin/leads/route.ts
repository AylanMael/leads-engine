import { getAdminAuth, getAdminDb } from "../../../../lib/firebase-admin";
import { isAdministrator } from "../../../../lib/admin-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const respond = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});

export async function GET(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) return respond({ error: "Connectez-vous pour consulter les demandes." }, 401);
  try {
    const identity = await getAdminAuth().verifyIdToken(token, true);
    if (!isAdministrator(identity)) return respond({ error: "Ce compte n’est pas autorisé à accéder à l’administration." }, 403);
  } catch {
    return respond({ error: "Votre session a expiré. Reconnectez-vous." }, 401);
  }
  try {
    const db = getAdminDb();
    const [leads, partners] = await Promise.all([
      db.collection("leads").orderBy("createdAt", "desc").get(),
      db.collection("partners").get(),
    ]);
    return respond({
      leads: leads.docs.map((document) => {
        const data = document.data();
        return { ...data, id: document.id,
          createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
          assignedAt: data.assignedAt?.toDate?.().toISOString() ?? null };
      }),
      partners: partners.docs.map((document) => {
        const data = document.data();
        return { id: document.id, companyName: data.companyName ?? data.displayName ?? document.id,
          vertical: data.vertical, credits: data.credits ?? 0, isActive: data.isActive === true,
          assignedDepartments: data.assignedDepartments ?? [], email: data.email ?? "",
          department: data.department ?? data.assignedDepartments?.[0] ?? "" };
      }),
    });
  } catch (error) {
    // No customer data or authentication token in server logs.
    console.error("Admin Firestore read failed", { code: (error as { code?: unknown }).code });
    return respond({ error: "Impossible de lire Firestore. Réessayez avec Actualiser." }, 503);
  }
}
