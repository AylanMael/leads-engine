"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LocalLead, LocalPartner } from "../../types/local-lead";

export default function AdminPage() {
  const [leads, setLeads] = useState<LocalLead[]>([]);
  const [partners, setPartners] = useState<LocalPartner[]>([]);
  const [assigning, setAssigning] = useState<string | null>(null);
  const assignmentPending = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [response, partnerResponse] = await Promise.all([
        fetch("/api/leads", { cache: "no-store", signal }),
        fetch("/api/partners", { cache: "no-store", signal }),
      ]);
      if (!response.ok || !partnerResponse.ok) throw new Error("Lecture impossible");
      const [data, partnerData]: [LocalLead[], LocalPartner[]] = await Promise.all([response.json(), partnerResponse.json()]);
      if (!Array.isArray(data) || !Array.isArray(partnerData)) throw new Error("Réponse invalide");
      if (!signal?.aborted) { setLeads(data); setPartners(partnerData); }
    } catch {
      if (!signal?.aborted) setError("Impossible de charger les leads locaux. Réessayez avec Actualiser.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadLeads(controller.signal);
    return () => controller.abort();
  }, [loadLeads]);

  function eligiblePartner(lead: LocalLead) {
    return partners.find((partner) => partner.vertical === lead.vertical && partner.department === lead.geo?.departurePostalCode.slice(0, 2));
  }

  async function assign(lead: LocalLead) {
    const partner = eligiblePartner(lead);
    if (!partner || assignmentPending.current) return;
    assignmentPending.current = true;
    setAssigning(lead.id);
    setError(null);
    try {
      const response = await fetch("/api/leads/assign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ leadId: lead.id, partnerId: partner.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Attribution impossible.");
      await loadLeads();
    } catch (error) { setError(error instanceof Error ? error.message : "Attribution impossible."); }
    finally { assignmentPending.current = false; setAssigning(null); }
  }

  const revenue = leads.reduce((total, lead) => total + (lead.status === "assigned" ? lead.vertical === "demenagement" ? 25 : 40 : 0), 0);

  const statistics = [
    { label: "Leads totaux", value: loading ? "…" : String(leads.length) },
    { label: "Chiffre d'affaires (démo)", value: loading ? "…" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(revenue) },
    { label: "Partenaires actifs", value: loading ? "…" : String(partners.length) },
  ];
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">
        Tableau de bord Administrateur
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        Vue provisoire — leads enregistrés sur le serveur local de développement.
        {" "}Valeur attribuée : 25 € par lead déménagement et 40 € par lead rénovation.
      </p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {statistics.map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <dt className="text-sm font-medium text-slate-600">{label}</dt>
            <dd className="mt-3 text-3xl font-semibold text-teal-800">{value}</dd>
          </div>
        ))}
      </dl>
      <section className="mt-10" aria-labelledby="leads-heading" aria-busy={loading}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="leads-heading" className="text-xl font-semibold text-slate-950">Leads reçus</h2>
          <button
            type="button"
            onClick={() => void loadLeads()}
            disabled={loading || assigning !== null}
            className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Chargement…" : "Actualiser"}
          </button>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-800">{error}</p>}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm text-slate-700">
            <caption className="sr-only">Leads locaux, du plus récent au plus ancien</caption>
            <thead className="bg-slate-100 text-slate-950">
              <tr>
                {["Nom", "Prénom", "Téléphone", "Ville de départ / chantier", "Ville d’arrivée", "Surface", "Statut", "Attribution"].map((label) => (
                  <th key={label} scope="col" className="whitespace-nowrap px-4 py-3 font-semibold">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {leads.map((lead) => (
                <tr key={lead.id}>
                  <td className="px-4 py-3">{lead.customer.lastName}</td>
                  <td className="px-4 py-3">{lead.customer.firstName}</td>
                  <td className="whitespace-nowrap px-4 py-3">{lead.customer.phone}</td>
                  <td className="px-4 py-3">{lead.geo?.departureCity ?? "—"}</td>
                  <td className="px-4 py-3">{lead.vertical === "demenagement" ? lead.geo.arrivalCity : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3">{lead.vertical === "demenagement" ? lead.projectDetails.surface : lead.property.surface} m²</td>
                  <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${lead.status === "assigned" ? "bg-teal-50 text-teal-900" : "bg-amber-50 text-amber-900"}`}>{lead.status === "assigned" ? "Attribué" : "En attente"}</span></td>
                  <td className="px-4 py-3">
                    {lead.status === "pending" ? (
                      <>
                        <button type="button" disabled={loading || assigning !== null || !eligiblePartner(lead) || (eligiblePartner(lead)?.credits ?? 0) < 1} onClick={() => void assign(lead)} className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50">{assigning === lead.id ? "Attribution…" : "Attribuer au partenaire local"}</button>
                        {!eligiblePartner(lead) && <p className="mt-1 text-xs text-slate-600">Aucun partenaire pour ce métier et ce département.</p>}
                        {eligiblePartner(lead)?.credits === 0 && <p className="mt-1 text-xs text-slate-600">Solde épuisé : rechargez dans l’espace partenaire.</p>}
                      </>
                    ) : (lead.assignedPartners ?? []).map((id) => partners.find((partner) => partner.id === id)?.companyName ?? id).join(", ")}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center">{loading ? "Chargement des leads…" : error ? "Liste indisponible." : "Aucun lead enregistré pour le moment."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
