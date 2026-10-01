"use client";

import { useEffect, useRef, useState } from "react";
import { CREDIT_PACKS } from "../config/credit-packs";
import { getPartnerAuth } from "../lib/firebase";

export default function CreditRecharge() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") setNotice("Retour du paiement : votre solde sera actualisé après confirmation sécurisée de Stripe.");
    else if (params.get("canceled") === "true") setNotice("Paiement annulé. Vous pouvez choisir un pack pour réessayer.");
  }, []);

  return (
    <section aria-label="Recharge de crédits" className="mb-8 rounded-xl border border-slate-200 bg-white p-4">
      {notice && <p role="status" className="mb-3 text-sm text-slate-700">{notice}</p>}
      <button type="button" aria-expanded={open} aria-controls="credit-packs" onClick={() => setOpen(!open)} className="min-h-12 rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2">Recharger mes crédits</button>
      {open && <div id="credit-packs" className="mt-4">
        <p className="mb-4 text-sm text-slate-600">Prix hors taxes. Les taxes applicables et le total sont présentés dans Stripe avant paiement.</p>
        <div className="grid gap-3 sm:grid-cols-3">{CREDIT_PACKS.map((pack) => (
          <button key={pack.id} disabled={busy} onClick={async () => {
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            setError(null);
            try {
              const user = getPartnerAuth()?.currentUser;
              if (!user) throw new Error("Veuillez vous reconnecter pour acheter des crédits.");
              const token = await user.getIdToken();
              const response = await fetch("/api/stripe/checkout", {
                method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ packId: pack.id }), signal: AbortSignal.timeout(30000),
              });
              const result = await response.json();
              if (!response.ok) throw new Error(result.error || "Le paiement est indisponible.");
              const url = new URL(result.url);
              if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com") throw new Error("URL de paiement invalide.");
              window.location.assign(url.href);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Le paiement est indisponible. Réessayez.");
              setBusy(false);
              pending.current = false;
            }
          }} className="min-h-16 rounded-xl border border-teal-700 px-4 py-3 text-teal-900 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:opacity-60">
            <span className="block font-bold">{pack.credits} crédits</span>
            <span>{new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(pack.amount / 100)} HT</span>
          </button>
        ))}</div>
      </div>}
      {busy && <p role="status" className="mt-3 text-sm">Ouverture du paiement sécurisé…</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
    </section>
  );
}
