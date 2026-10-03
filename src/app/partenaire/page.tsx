"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, onSnapshot, query, Timestamp, where, type DocumentData } from "firebase/firestore";
import { getLeadFirestore, getPartnerAuth, isFirebaseConfigured } from "../../lib/firebase";
import LocalPartnerDashboard from "../../components/LocalPartnerDashboard";
import CreditRecharge from "../../components/CreditRecharge";
import LeadDisputeAction from "../../components/LeadDisputeAction";

type Lead = { id: string; data: DocumentData };
const value = (input: unknown) => typeof input === "string" || typeof input === "number" ? String(input) : "Non renseigné";
const yesNo = (input: unknown) => typeof input === "boolean" ? input ? "Oui" : "Non" : "Non renseigné";
function telephone(input: unknown) {
  if (typeof input !== "string") return null;
  const phone = input.replace(/^0([1-79][0-9]{8})$/, "+33$1");
  return /^\+33[1-79][0-9]{8}$/.test(phone) ? phone : null;
}

export default function PartnerPage() {
  return !isFirebaseConfigured && process.env.NODE_ENV === "development"
    ? <LocalPartnerDashboard />
    : <FirebasePartnerPage />;
}

function FirebasePartnerPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DocumentData | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  useEffect(() => {
    let cleanupSession = () => {};
    let stopAuth = () => {};
    try {
      const auth = getPartnerAuth();
      const db = getLeadFirestore();
      if (!auth || !db) {
        setError("L’espace partenaire n’est pas encore configuré.");
        return;
      }
      stopAuth = onAuthStateChanged(auth, (user) => {
        cleanupSession();
        setPartnerId(user?.uid ?? null);
        setProfile(null);
        setLeads(null);
        setError(null);
        if (!user) { router.replace("/partenaire/login"); return; }
        let active = true;
        let stopLeads = () => {};
        let subscribed = false;
        const stopProfile = onSnapshot(doc(db, "partners", user.uid), (snapshot) => {
          if (!active) return;
          if (!snapshot.exists()) {
            stopLeads();
            subscribed = false;
            setProfile(null);
            setLeads(null);
            setError("Aucun profil partenaire n’est associé à votre compte. Contactez votre interlocuteur.");
            return;
          }
          setProfile(snapshot.data());
          if (!subscribed) {
            subscribed = true;
            setError(null);
            stopLeads = onSnapshot(query(collection(db, "leads"), where("assignedPartners", "array-contains", user.uid)), (results) => {
              const receivedAt = (data: DocumentData) => {
                const date = data.partnerAssignedAt?.[user.uid] ?? data.assignedAt;
                return date instanceof Timestamp ? date.toMillis() : 0;
              };
              if (active) setLeads(results.docs.map((item) => ({ id: item.id, data: item.data() }))
                .sort((a, b) => receivedAt(b.data) - receivedAt(a.data)));
            }, () => {
              if (active) { setLeads(null); setError("Impossible de charger les demandes. Rechargez la page pour réessayer."); }
            });
          }
        }, () => {
          if (!active) return;
          stopLeads();
          setProfile(null);
          setLeads(null);
          setError("Impossible de charger votre profil partenaire. Rechargez la page pour réessayer.");
        });
        cleanupSession = () => { active = false; stopProfile(); stopLeads(); };
      }, () => {
        cleanupSession();
        setProfile(null);
        setLeads(null);
        setError("Votre session ne peut pas être vérifiée. Rechargez la page.");
      });
    } catch {
      setError("L’espace partenaire est indisponible. Rechargez la page.");
    }
    return () => { stopAuth(); cleanupSession(); };
  }, [router]);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-teal-800">Espace partenaire</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-950">{profile ? value(profile.legalEntity ?? profile.companyName ?? profile.displayName) : "Vos demandes de devis"}</h1>
          {profile && <p role="status" className="mt-3 inline-block rounded-full bg-teal-100 px-4 py-2 font-semibold text-teal-900">{typeof profile.credits === "number" ? `${profile.credits} crédit(s) restant(s)` : "Solde indisponible"}</p>}
        </div>
        <button disabled={signingOut} onClick={async () => {
          setSigningOut(true);
          try {
            const auth = getPartnerAuth();
            if (auth) await signOut(auth);
            setProfile(null);
            setLeads(null);
            router.replace("/partenaire/login");
          } catch { setError("La déconnexion a échoué. Veuillez réessayer."); }
          finally { setSigningOut(false); }
        }} className="min-h-11 rounded-lg border border-slate-400 px-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:opacity-60">{signingOut ? "Déconnexion…" : "Se déconnecter"}</button>
      </header>
      {profile && <CreditRecharge />}
      {error && <p role="alert" className="mb-6 rounded-xl bg-red-50 p-4 text-red-800">{error}</p>}
      {!error && (!profile || leads === null) && <p role="status" className="text-slate-600">Chargement de votre espace…</p>}
      {profile && leads && (
        <section aria-labelledby="leads-heading">
          <h2 id="leads-heading" className="mb-4 text-xl font-bold">Demandes reçues ({leads.length})</h2>
          {leads.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600">Aucune demande attribuée pour le moment. Les nouvelles demandes apparaîtront ici.</p>}
          <ul className="space-y-5">
            {leads.map(({ id, data }) => {
              const renovation = data.vertical === "renovation";
              const project = (renovation ? data.property : data.projectDetails) ?? {};
              const geo = data.geo ?? {};
              const customer = data.customer ?? {};
              const phone = telephone(customer.phone);
              const receivedAt = data.partnerAssignedAt?.[partnerId ?? ""] ?? data.assignedAt;
              const date = receivedAt instanceof Timestamp ? receivedAt.toDate() : null;
              const details = renovation
                ? [["Travaux", value(data.projectType)], ["Bâti", value(project.buildingType)], ["Budget", value(data.budgetBracket)], ["Statut", value(project.occupancyStatus)]]
                : [["Destination", `${value(geo.arrivalCity)} (${value(geo.arrivalPostalCode)})`], ["Logement", value(project.housingType)], ["Étages départ / arrivée", `${value(project.departureFloor)} / ${value(project.arrivalFloor)}`], ["Ascenseurs départ / arrivée", `${yesNo(project.departureElevator)} / ${yesNo(project.arrivalElevator)}`], ["Date souhaitée", value(project.targetDate)]];
              return (
                <li key={id}>
                  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <p className="text-sm text-slate-600">Reçu {date ? <time dateTime={date.toISOString()}>{new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" }).format(date)}</time> : "à une date non renseignée"}</p>
                    <h3 className="mt-2 text-xl font-bold">{renovation ? "Rénovation" : "Déménagement"} · {value(geo.departureCity)} {typeof geo.departurePostalCode === "string" && `(${geo.departurePostalCode})`}</h3>
                    <dl className="my-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                      {[["Surface", `${value(project.surface)} m²`], ...details].map(([label, content]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd className="mt-1 break-words font-medium text-slate-900">{content}</dd></div>)}
                    </dl>
                    <p className="mb-3 font-medium">{value(customer.firstName)} {value(customer.lastName)}</p>
                    {phone ? <a href={`tel:${phone}`} aria-label={`Appeler ${value(customer.firstName)} ${value(customer.lastName)}`} className="flex min-h-12 items-center justify-center rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2">Appeler le client</a> : <p className="text-sm text-slate-600">Numéro de téléphone indisponible.</p>}
                    {partnerId && <LeadDisputeAction key={`${partnerId}-${id}`} leadId={id} refunded={Array.isArray(data.disputedPartners) && data.disputedPartners.includes(partnerId)} />}
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
