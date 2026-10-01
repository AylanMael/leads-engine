"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getTenantConfig, type TenantConfig } from "../config/tenant";

const TenantContext = createContext<TenantConfig | null>(null);

export function TenantProvider({ tenant, children }: { tenant: TenantConfig; children: ReactNode }) {
  return <TenantContext.Provider value={tenant}>{children}</TenantContext.Provider>;
}

/** Réutilise la marque du rendu serveur pour une hydratation cohérente. */
export function useTenantConfig() {
  return useContext(TenantContext) ?? getTenantConfig();
}
