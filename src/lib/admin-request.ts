import "server-only";
import { getAdminAuth } from "./firebase-admin";
import { isAdministrator } from "./admin-access";

export class AdminError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const adminResponse = (body: unknown, status = 200) => Response.json(body, {
  status, headers: { "Cache-Control": "private, no-store" },
});
export async function requireAdmin(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/)?.[1];
  if (!token) throw new AdminError(401, "Connexion administrateur requise.");
  let identity;
  try { identity = await getAdminAuth().verifyIdToken(token, true); }
  catch { throw new AdminError(401, "Session invalide. Reconnectez-vous."); }
  if (!isAdministrator(identity)) throw new AdminError(403, "Accès administrateur requis.");
  return identity.uid;
}
export function adminFailure(error: unknown) {
  if (error instanceof AdminError) return adminResponse({ error: error.message }, error.status);
  console.error("Admin operation failed", { code: (error as { code?: unknown })?.code });
  return adminResponse({ error: "Opération indisponible. Veuillez réessayer." }, 503);
}
