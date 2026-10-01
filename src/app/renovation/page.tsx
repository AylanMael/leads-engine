import type { Metadata } from "next";
import LeadFormRenovation from "../../components/LeadFormRenovation";
import { getTenantConfig } from "../../config/tenant";
import { TenantProvider } from "../../components/TenantProvider";

export const metadata: Metadata = {
  title: "Artisans Rénov | Devis de rénovation locaux",
  description: "Préparez vos travaux avec des artisans locaux : jusqu’à 2 devis, sans spam commercial. Un professionnel vous contacte sous 24h.",
};

/** Cible interne de la réécriture de la racine du domaine rénovation. */
export default function RenovationPage() {
  const tenant = getTenantConfig("renovation");
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mx-auto mb-8 max-w-3xl text-center">
        <p className={`mb-4 text-sm font-semibold ${tenant.theme.accent}`}>{tenant.brandName}</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">{tenant.labels.mainTitle}</h1>
        <p className="mt-5 text-lg text-slate-700">{tenant.labels.tagline}</p>
      </header>
      <TenantProvider tenant={tenant}><LeadFormRenovation /></TenantProvider>
      <p className="mx-auto mt-6 max-w-2xl text-center text-sm text-slate-600">{tenant.labels.matchingPromise}</p>
    </main>
  );
}
