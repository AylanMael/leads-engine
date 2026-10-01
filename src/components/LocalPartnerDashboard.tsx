"use client";

import { useEffect, useRef, useState } from "react";
import type { LocalLead, LocalPartner } from "../types/local-lead";

const buttonClass = "min-h-11 rounded-lg border border-slate-300 px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 disabled:opacity-50";

export default function LocalPartnerDashboard() {
  const [partners, setPartners] = useState<LocalPartner[]>([]);
  const [partnerId, setPartnerId] = useState("");
  const [leads, setLeads] = useState<LocalLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const purchasePending = useRef(false);
  const partner = partners.find(({ id }) => id === partnerId);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setLeads([]);
    void (async () => {
      try {
        const response = await fetch("/api/partners", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Impossible de charger les partenaires.");
        const list: LocalPartner[] = await response.json();
        if (controller.signal.aborted) return;
        setPartners(list);
        const selected = partnerId || list[0]?.id;
        if (!partnerId && selected) { setPartnerId(selected); return; }
        if (!selected) return;
        const result = await fetch(`/api/leads?partnerId=${encodeURIComponent(selected)}`, { cache: "no-store", signal: controller.signal });
        if (!result.ok) throw new Error("Impossible de charger les leads attribués.");
        const items: LocalLead[] = await result.json();
        if (!controller.signal.aborted) setLeads(items);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Chargement impossible.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [partnerId, revision]);

  async function buyCredits() {
    if (purchasePending.current || !partnerId) return;
    purchasePending.current = true;
    setBuying(true);
    setError(null);
    try {
      const response = await fetch("/api/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partnerId, credits: 5 }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Recharge impossible.");
      setPartners((items) => items.map((item) => item.id === result.partner.id ? result.partner : item));
      setRevision((value) => value + 1);
    } catch (error) { setError(error instanceof Error ? error.message : "Recharge impossible."); }
    finally { purchasePending.current = false; setBuying(false); }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <p className="text-sm font-semibold text-teal-800">Espace partenaire · Démonstration locale</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">{partner?.companyName ?? "Vos demandes de devis"}</h1>
      <label htmlFor="local-partner" className="mt-6 block font-medium">Partenaire de test</label>
      <select id="local-partner" value={partnerId} disabled={buying || partners.length === 0} onChange={(event) => { setPartnerId(event.target.value); setLeads([]); }} className="mt-2 min-h-12 w-full rounded-xl border border-slate-400 bg-white px-3 focus:ring-2 focus:ring-teal-700">
        {partners.map((item) => <option key={item.id} value={item.id}>{item.companyName}</option>)}
      </select>
      <div className="my-6 flex flex-wrap items-center gap-3">
        {partner && <p role="status" className="rounded-full bg-teal-100 px-4 py-2 font-semibold text-teal-900">{partner.credits} crédit(s) restant(s)</p>}
        <button type="button" disabled={!partner || buying || loading} onClick={() => void buyCredits()} className={`${buttonClass} bg-teal-800 text-white`}>{buying ? "Recharge…" : "Acheter 5 crédits (Démo)"}</button>
        <button type="button" disabled={loading || buying} onClick={() => setRevision((value) => value + 1)} className={buttonClass}>Actualiser</button>
      </div>
      <p className="mb-6 text-sm text-slate-600">Aucun paiement réel. Un crédit est débité pour chaque lead attribué.</p>
      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {loading ? <p role="status">Chargement…</p> : (
        <section aria-labelledby="local-leads-heading">
          <h2 id="local-leads-heading" className="mb-4 text-xl font-bold">Demandes reçues ({leads.length})</h2>
          {leads.length === 0 && !error && <p>Aucune demande attribuée pour le moment.</p>}
          <ul className="space-y-4">
            {leads.map((lead) => (
              <li key={lead.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm text-slate-600">Reçu le <time dateTime={lead.assignedAt ?? lead.createdAt}>{new Date(lead.assignedAt ?? lead.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</time></p>
                <h3 className="mt-2 text-lg font-bold">{lead.geo?.departureCity ?? "Commune non renseignée"} {lead.geo?.departurePostalCode}</h3>
                <p className="mt-2">Surface : {lead.vertical === "demenagement" ? lead.projectDetails.surface : lead.property.surface} m²</p>
                <p className="my-3 font-medium">{lead.customer.firstName} {lead.customer.lastName}</p>
                <a href={`tel:${lead.customer.phone.replace(/^0/, "+33")}`} className="inline-flex min-h-11 items-center rounded-lg bg-teal-800 px-4 py-2 font-semibold text-white focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2">Appeler : {lead.customer.phone}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
