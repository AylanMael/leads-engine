"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { getPartnerAuth, isFirebaseConfigured } from "../../lib/firebase";
import type { LocalLead, LocalPartner } from "../../types/local-lead";
import AdminPartners, { type AdminPartner } from "../../components/AdminPartners";

type WithFirestoreStatus<T> = T extends unknown ? Omit<T, "status"> & { status: string } : never;
type AdminLead = WithFirestoreStatus<LocalLead>;
const localMode = process.env.NODE_ENV === "development" && !isFirebaseConfigured;
const statusLabels: Record<string, string> = { pending: "En attente", assigned: "Attribué", unassigned: "Sans partenaire", disputed: "Contesté" };

export default function AdminPage() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [partners, setPartners] = useState<AdminPartner[]>([]);
  const [selectedPartners, setSelectedPartners] = useState<Record<string, string>>({});
  const [signedIn, setSignedIn] = useState(false);
  const [authReady, setAuthReady] = useState(localMode);
  const [connecting, setConnecting] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);
  const assignmentPending = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadLeads = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      if (!localMode) {
        const user = getPartnerAuth()?.currentUser;
        if (!user) { setLeads([]); setPartners([]); return; }
        const response = await fetch("/api/admin/leads", { cache: "no-store", signal,
          headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Lecture Firestore impossible.");
        if (!Array.isArray(data.leads) || !Array.isArray(data.partners)) throw new Error("Réponse invalide.");
        if (!signal?.aborted && getPartnerAuth()?.currentUser?.uid === user.uid) { setLeads(data.leads); setPartners(data.partners); }
        return;
      }
      const [response, partnerResponse] = await Promise.all([
        fetch("/api/leads", { cache: "no-store", signal }),
        fetch("/api/partners", { cache: "no-store", signal }),
      ]);
      if (!response.ok || !partnerResponse.ok) throw new Error("Lecture impossible");
      const [data, partnerData]: [LocalLead[], LocalPartner[]] = await Promise.all([response.json(), partnerResponse.json()]);
      if (!Array.isArray(data) || !Array.isArray(partnerData)) throw new Error("Réponse invalide");
      if (!signal?.aborted) { setLeads(data); setPartners(partnerData); }
    } catch (cause) {
      if (!signal?.aborted) {
        setLeads([]); setPartners([]);
        setError(cause instanceof Error ? cause.message : "Impossible de charger les demandes. Réessayez avec Actualiser.");
      }
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let controller = new AbortController();
    if (localMode) {
      void loadLeads(controller.signal);
      return () => controller.abort();
    }
    const auth = getPartnerAuth();
    if (!auth) { setAuthReady(true); setLoading(false); setError("La connexion Firebase n’est pas configurée."); return; }
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      controller.abort(); controller = new AbortController();
      setSignedIn(Boolean(user)); setAuthReady(true); setLeads([]); setPartners([]); setError(null);
      if (user) void loadLeads(controller.signal);
      else setLoading(false);
    }, () => { setAuthReady(true); setLoading(false); setError("Impossible de vérifier votre session."); });
    return () => { controller.abort(); unsubscribe(); };
  }, [loadLeads]);

  function eligiblePartner(lead: AdminLead) {
    return partners.find((partner) => partner.vertical === lead.vertical && partner.department === lead.geo?.departurePostalCode.slice(0, 2));
  }

  function eligiblePartners(lead: AdminLead) {
    return partners.filter((partner) => partner.isActive && partner.credits >= 1 && partner.vertical === lead.vertical
      && partner.assignedDepartments?.includes(lead.geo?.departurePostalCode.slice(0, 2) ?? "")
      && !lead.assignedPartners?.includes(partner.id));
  }

  async function assign(lead: AdminLead) {
    const candidates = eligiblePartners(lead);
    const partner = localMode ? eligiblePartner(lead)
      : candidates.find((item) => item.id === selectedPartners[lead.id]) ?? candidates[0];
    if (!partner || assignmentPending.current) return;
    assignmentPending.current = true;
    setAssigning(lead.id);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (!localMode) {
        const user = getPartnerAuth()?.currentUser;
        if (!user) throw new Error("Session administrateur requise.");
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }
      const response = await fetch(localMode ? "/api/leads/assign" : "/api/admin/leads/assign", { method: "POST", headers, body: JSON.stringify({ leadId: lead.id, partnerId: partner.id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Attribution impossible.");
      await loadLeads();
    } catch (error) { setError(error instanceof Error ? error.message : "Attribution impossible."); }
    finally { assignmentPending.current = false; setAssigning(null); }
  }

  const revenue = leads.reduce((total, lead) => total + (lead.status === "assigned" ? lead.vertical === "demenagement" ? 25 : 40 : 0), 0);

  const statistics = [
    { label: "Leads totaux", value: loading || error ? "—" : String(leads.length) },
    { label: "Valeur des leads attribués (estimée)", value: loading || error ? "—" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(revenue) },
    { label: "Partenaires actifs", value: loading || error ? "—" : String(partners.filter((partner) => localMode || partner.isActive).length) },
  ];
  if (!localMode && (!authReady || !signedIn)) return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-3xl font-bold text-slate-950">Tableau de bord Administrateur</h1>
      <p className="mt-4 text-slate-600">Connectez-vous avec votre compte Google administrateur pour consulter les demandes.</p>
      {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
      <button type="button" disabled={!authReady || connecting || !isFirebaseConfigured} className="mt-6 rounded-xl bg-teal-800 px-5 py-3 font-semibold text-white focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50" onClick={async () => {
        const auth = getPartnerAuth();
        if (!auth) return;
        setConnecting(true); setError(null);
        try {
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: "select_account" });
          await signInWithPopup(auth, provider);
        } catch { setError("Connexion impossible. Autorisez la fenêtre de connexion Google et réessayez."); }
        finally { setConnecting(false); }
      }}>{!authReady ? "Vérification…" : connecting ? "Connexion…" : "Se connecter avec Google"}</button>
    </main>
  );
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-950">
        Tableau de bord Administrateur
      </h1>
      <p className="mt-3 text-sm text-slate-600">
        {localMode ? "Mode démo — demandes du serveur local." : "Demandes enregistrées dans Firebase."}
        {" "}Valeur attribuée : 25 € par lead déménagement et 40 € par lead rénovation.
      </p>
      {!localMode && <button type="button" className="mt-3 text-sm text-teal-800 underline" onClick={async () => {
        try { const auth = getPartnerAuth(); if (auth) await signOut(auth); }
        catch { setError("Déconnexion impossible. Réessayez."); }
      }}>Se déconnecter / changer de compte</button>}
      <dl className="mt-8 grid gap-4 sm:grid-cols-3">
        {statistics.map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <dt className="text-sm font-medium text-slate-600">{label}</dt>
            <dd className="mt-3 text-3xl font-semibold text-teal-800">{value}</dd>
          </div>
        ))}
      </dl>
      {!localMode && <AdminPartners partners={partners} onCreated={loadLeads} />}
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
            <caption className="sr-only">Demandes reçues, du plus récent au plus ancien</caption>
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
                  <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${lead.status === "assigned" ? "bg-teal-50 text-teal-900" : "bg-amber-50 text-amber-900"}`}>{statusLabels[lead.status] ?? lead.status}</span></td>
                  <td className="px-4 py-3">
                    {!localMode && <>
                      <p>{(lead.assignedPartners ?? []).map((id) => partners.find((partner) => partner.id === id)?.companyName ?? id).join(", ") || "Aucun partenaire attribué"}</p>
                      {["pending", "unassigned", "assigned"].includes(lead.status) && (lead.assignedPartners?.length ?? 0) < 2 && <div className="mt-2 space-y-2">
                        {eligiblePartners(lead).length ? <>
                          <select aria-label={`Partenaire pour ${lead.customer.firstName} ${lead.customer.lastName}`} disabled={loading || assigning !== null}
                            value={eligiblePartners(lead).some((partner) => partner.id === selectedPartners[lead.id]) ? selectedPartners[lead.id] : eligiblePartners(lead)[0]?.id}
                            onChange={(event) => setSelectedPartners((current) => ({ ...current, [lead.id]: event.target.value }))}
                            className="w-full rounded-lg border border-slate-400 p-2 focus:ring-2 focus:ring-teal-700">
                            {eligiblePartners(lead).map((partner) => <option key={partner.id} value={partner.id}>{partner.companyName} ({partner.credits} crédits)</option>)}
                          </select>
                          <button type="button" disabled={loading || assigning !== null} onClick={() => void assign(lead)} className="rounded-lg bg-teal-800 px-3 py-2 text-white focus:ring-2 focus:ring-teal-600 disabled:opacity-50">{assigning === lead.id ? "Attribution…" : "Attribuer · 1 crédit"}</button>
                        </> : <p className="text-xs text-slate-600">Aucun partenaire actif compatible avec des crédits.</p>}
                      </div>}
                    </>}
                    {localMode && <>
                    {lead.status === "pending" && localMode ? (
                      <>
                        <button type="button" disabled={loading || assigning !== null || !eligiblePartner(lead) || (eligiblePartner(lead)?.credits ?? 0) < 1} onClick={() => void assign(lead)} className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-900 focus-visible:ring-2 focus-visible:ring-teal-600 disabled:opacity-50">{assigning === lead.id ? "Attribution…" : "Attribuer au partenaire local"}</button>
                        {!eligiblePartner(lead) && <p className="mt-1 text-xs text-slate-600">Aucun partenaire pour ce métier et ce département.</p>}
                        {eligiblePartner(lead)?.credits === 0 && <p className="mt-1 text-xs text-slate-600">Solde épuisé : rechargez dans l’espace partenaire.</p>}
                      </>
                    ) : (lead.assignedPartners ?? []).map((id) => partners.find((partner) => partner.id === id)?.companyName ?? id).join(", ") || "En attente d’attribution"}
                    </>}
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
