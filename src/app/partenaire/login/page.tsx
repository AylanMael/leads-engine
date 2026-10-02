"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { GoogleAuthProvider, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { getPartnerAuth } from "../../../lib/firebase";

export default function PartnerLoginPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useRef(false);
  const errorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    try {
      const auth = getPartnerAuth();
      if (!auth) {
        setError("La connexion partenaire n’est pas encore configurée.");
        return;
      }
      return onAuthStateChanged(auth, (user) => {
        if (user) router.replace("/partenaire");
        else setReady(true);
      }, () => setError("Impossible de vérifier votre session. Rechargez la page."));
    } catch {
      setError("Le service de connexion est indisponible.");
    }
  }, [router]);

  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  return (
    <main className="mx-auto max-w-md px-4 py-12 sm:py-20">
      <h1 className="text-3xl font-bold text-slate-950">Connexion partenaire</h1>
      <p className="mt-3 text-slate-600">Retrouvez vos demandes de devis et votre solde de crédits.</p>
      <form className="mt-8 space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-busy={busy} onSubmit={async (event) => {
        event.preventDefault();
        if (!ready || pending.current) return;
        const data = new FormData(event.currentTarget);
        pending.current = true;
        setBusy(true);
        setError(null);
        try {
          const auth = getPartnerAuth();
          if (!auth) throw new Error("Configuration absente");
          await signInWithEmailAndPassword(auth, String(data.get("email")).trim(), String(data.get("password")));
          router.replace("/partenaire");
        } catch (cause) {
          setError(cause instanceof FirebaseError && cause.code === "auth/network-request-failed"
            ? "Connexion réseau indisponible. Vérifiez votre connexion et réessayez."
            : cause instanceof FirebaseError && cause.code === "auth/too-many-requests"
              ? "Trop de tentatives. Veuillez réessayer plus tard."
              : "Connexion impossible. Vérifiez vos identifiants et réessayez.");
        } finally {
          pending.current = false;
          setBusy(false);
        }
      }}>
        <div>
          <label htmlFor="partner-email" className="font-medium">E-mail professionnel</label>
          <input id="partner-email" name="email" type="email" autoComplete="username" required disabled={!ready || busy} className="mt-2 min-h-12 w-full rounded-xl border border-slate-400 px-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
        </div>
        <div>
          <label htmlFor="partner-password" className="font-medium">Mot de passe</label>
          <input id="partner-password" name="password" type="password" autoComplete="current-password" required disabled={!ready || busy} className="mt-2 min-h-12 w-full rounded-xl border border-slate-400 px-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-700" />
        </div>
        {error && <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 focus:outline-none focus:ring-2 focus:ring-red-700">{error}</p>}
        {notice && <p role="status" className="text-sm text-teal-800">{notice}</p>}
        <button disabled={!ready || busy} className="min-h-12 w-full rounded-xl bg-teal-700 px-4 py-3 font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:opacity-60">{busy ? "Connexion…" : "Se connecter"}</button>
        <button type="button" disabled={!ready || busy} className="min-h-12 w-full rounded-xl border border-slate-400 px-4 py-3 font-semibold focus:ring-2 focus:ring-teal-700 disabled:opacity-60" onClick={async () => {
          const auth = getPartnerAuth(); if (!auth || pending.current) return;
          pending.current = true; setBusy(true); setError(null); setNotice(null);
          try { const provider = new GoogleAuthProvider(); provider.setCustomParameters({ prompt: "select_account" }); await signInWithPopup(auth, provider); }
          catch { setError("Connexion Google impossible. Autorisez la fenêtre de connexion et réessayez."); }
          finally { pending.current = false; setBusy(false); }
        }}>Se connecter avec Google</button>
        <button type="button" disabled={!ready || busy} className="text-sm text-teal-800 underline focus:ring-2 focus:ring-teal-700 disabled:opacity-60" onClick={async (event) => {
          const auth = getPartnerAuth(); if (!auth || pending.current || !event.currentTarget.form) return;
          const email = String(new FormData(event.currentTarget.form).get("email") ?? "").trim();
          if (!email) { setError("Renseignez votre e-mail de connexion."); return; }
          pending.current = true; setBusy(true); setError(null); setNotice(null);
          try {
            await sendPasswordResetEmail(auth, email);
            setNotice("Si cette adresse correspond à un compte, un e-mail permet de définir ou réinitialiser son mot de passe. Vérifiez aussi les indésirables.");
          } catch { setError("Impossible d’envoyer le lien. Vérifiez l’adresse et réessayez plus tard."); }
          finally { pending.current = false; setBusy(false); }
        }}>Première connexion / mot de passe oublié</button>
        {!ready && !error && <p role="status" className="text-sm text-slate-600">Vérification de votre session…</p>}
      </form>
    </main>
  );
}
