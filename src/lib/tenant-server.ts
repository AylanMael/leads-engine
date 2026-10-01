import "server-only";
import { headers } from "next/headers";
import { getTenantConfig, resolveVerticalFromHost } from "../config/tenant";

/** Lecture par requête : aucune variable globale mutable entre les domaines. */
export async function getServerTenantConfig() {
  const requestHeaders = await headers();
  const vertical = requestHeaders.get("x-vertical");
  return getTenantConfig(vertical === "renovation" || vertical === "demenagement"
    ? vertical
    : resolveVerticalFromHost(requestHeaders.get("host")));
}
