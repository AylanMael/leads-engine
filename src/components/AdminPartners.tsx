"use client";

import { useRef, useState } from "react";
import { getPartnerAuth } from "../lib/firebase";

export type AdminPartner = {
  id: string; companyName: string; vertical: "demenagement" | "renovation";
  department: string; assignedDepartments?: string[]; credits: number; isActive?: boolean; email?: string;
};

export default function AdminPartners({ partners, onCreated }: { partners: AdminPartner[]; onCreated: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const inputClass = "mt-1 w-full rounded-lg border border-slate-400 px-3 py-2 focus:ring-2 focus:ring-teal-700";
  return <section className="mt-10 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="partners-title">
    <h2 id="partners-title" className="text-xl font-semibold">Partenaires Firebase</h2>
    <ul className="my-4 space-y-2 text-sm">
      {partners.map((partner) => <li key={partner.id} className="rounded-lg bg-slate-50 p-3">
        <strong>{partner.companyName}</strong> · {partner.vertical} · {(partner.assignedDepartments ?? [partner.department]).join(", ")}
        <span className="ml-2 rounded-full bg-teal-100 px-2 py-1">{partner.credits} crédits</span>
        <p className="mt-1 text-slate-600">{partner.email} · {partner.isActive ? "Actif" : "Inactif"}</p>
      </li>)}
      {!partners.length && <li>Aucun partenaire enregistré.</li>}
    </ul>
    <details>
      <summary className="cursor-pointer font-semibold text-teal-800">Créer un partenaire</summary>
      <form className="mt-4 grid gap-4 sm:grid-cols-2" aria-busy={busy} onSubmit={async (event) => {
        event.preventDefault();
        if (pending.current) return;
        const form = event.currentTarget, data = new FormData(form);
        pending.current = true; setBusy(true); setError(null); setMessage(null);
        try {
          const user = getPartnerAuth()?.currentUser;
          if (!user) throw new Error("Reconnectez-vous à l’administration.");
          const response = await fetch("/api/admin/partners", { method: "POST", headers: {
            "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}`,
          }, body: JSON.stringify({ companyName: String(data.get("companyName")).trim(),
            email: String(data.get("email")).trim(), vertical: data.get("vertical"),
            assignedDepartments: String(data.get("departments")).split(",").map((value) => value.trim().toUpperCase()).filter(Boolean),
            credits: Number(data.get("credits")) }) });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Création impossible.");
          setMessage(result.created ? "Partenaire créé. Il peut se connecter avec Google ou définir son mot de passe sur la page de connexion partenaire." : "Ce compte possède déjà un profil partenaire. Son solde est conservé.");
          form.reset();
          await onCreated();
        } catch (cause) { setError(cause instanceof Error ? cause.message : "Création impossible."); }
        finally { pending.current = false; setBusy(false); }
      }}>
        <label>Raison sociale<input name="companyName" required minLength={2} maxLength={150} disabled={busy} className={inputClass} /></label>
        <label>E-mail de connexion<input name="email" type="email" required maxLength={254} disabled={busy} className={inputClass} /></label>
        <label>Métier<select name="vertical" disabled={busy} className={inputClass}><option value="demenagement">Déménagement</option><option value="renovation">Rénovation</option></select></label>
        <label>Départements (séparés par des virgules)<input name="departments" required defaultValue="78" disabled={busy} className={inputClass} /></label>
        <label>Crédits offerts à la création<input name="credits" type="number" required min={0} max={1000} step={1} defaultValue={0} disabled={busy} className={inputClass} /></label>
        <button disabled={busy} className="self-end rounded-lg bg-teal-800 px-4 py-3 font-semibold text-white focus:ring-2 focus:ring-teal-600 disabled:opacity-50">{busy ? "Création…" : "Créer le partenaire"}</button>
      </form>
    </details>
    {message && <p role="status" className="mt-4 text-teal-800">{message}</p>}
    {error && <p role="alert" className="mt-4 text-red-800">{error}</p>}
    <p className="mt-4 text-sm text-slate-600">Accès : <a className="underline" href="/partenaire/login">/partenaire/login</a>. Aucun e-mail n’est envoyé automatiquement à la création.</p>
  </section>;
}
