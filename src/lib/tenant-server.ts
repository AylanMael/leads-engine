import "server-only";
import { getTenantConfig } from "../config/tenant";

/** Même marque sur le serveur et le client, définie au build. */
export async function getServerTenantConfig() {
  return getTenantConfig();
}
