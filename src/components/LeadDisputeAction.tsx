"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { getPartnerAuth } from "../lib/firebase";
import { DISPUTE_REASONS, DisputeSchema } from "../types/dispute";

export default function LeadDisputeAction({ leadId, refunded }: { leadId: string; refunded: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  const reasonId = useId();
  const commentId = useId();
  const errorId = useId();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const form = new FormData(event.currentTarget);
    const input = DisputeSchema.safeParse({ leadId, reason: form.get("reason"), comment: form.get("comment") });
    if (!input.success) { setError("Choisissez un motif et renseignez votre commentaire."); return; }
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      const user = getPartnerAuth()?.currentUser;
      if (!user) throw new Error("Veuillez vous reconnecter pour contester cette demande.");
      const token = await user.getIdToken();
      const response = await fetch("/api/leads/dispute", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(input.data), signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error(result.error || "La contestation n’a pas pu être confirmée.");
      setDone(true);
      dialog.current?.close();
    } catch (cause) {
      setError(cause instanceof Error && cause.name !== "TimeoutError" && cause.name !== "TypeError"
        ? cause.message : "Connexion interrompue. Réessayez : un même lead ne peut être remboursé qu’une fois par partenaire.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return <div className="mt-3">
    <button ref={trigger} type="button" aria-haspopup="dialog" onClick={() => { setError(null); dialog.current?.showModal(); }}
      className="min-h-11 rounded-lg px-2 text-sm text-slate-600 underline underline-offset-4 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-teal-700">
      {refunded || done ? "Voir ma contestation" : "Signaler un problème"}
    </button>
    {(refunded || done) && <p role="status" className="text-sm font-medium text-teal-800">Contestation enregistrée · 1 crédit remboursé.</p>}
    <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
      onCancel={(event) => { if (pending.current) event.preventDefault(); }}
      onClose={() => trigger.current?.focus()}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-6 text-slate-950 shadow-xl backdrop:bg-slate-950/50">
      <h2 id={titleId} className="text-xl font-bold">Signaler un problème</h2>
      <p id={descriptionId} className="mt-2 text-sm text-slate-600">Vous disposez de 48 heures après l’attribution. Une contestation recevable recrédite votre compte de 1 crédit et est transmise à l’administrateur pour contrôle.</p>
      {refunded || done ? <div>
        <p className="my-5 font-medium text-teal-800">Votre crédit a été remboursé. Aucun autre remboursement ne sera effectué pour cette attribution.</p>
        <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-lg border border-slate-400 px-4 focus:outline-none focus:ring-2 focus:ring-teal-700">Fermer</button>
      </div> : <form onSubmit={submit} aria-busy={busy} className="mt-5 space-y-4">
        <div>
          <label htmlFor={reasonId} className="mb-1 block text-sm font-semibold">Motif</label>
          <select id={reasonId} name="reason" required defaultValue="" disabled={busy} className="min-h-12 w-full rounded-lg border border-slate-400 bg-white px-3 focus:outline-none focus:ring-2 focus:ring-teal-700">
            <option value="" disabled>Choisir un motif</option>
            {Object.entries(DISPUTE_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={commentId} className="mb-1 block text-sm font-semibold">Expliquez le problème (obligatoire)</label>
          <textarea id={commentId} name="comment" required maxLength={2000} rows={4} disabled={busy} aria-describedby={error ? errorId : undefined}
            className="w-full rounded-lg border border-slate-400 p-3 focus:outline-none focus:ring-2 focus:ring-teal-700" />
        </div>
        {error && <p id={errorId} role="alert" className="text-sm text-red-800">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => dialog.current?.close()} className="min-h-12 rounded-lg border border-slate-400 px-4 focus:outline-none focus:ring-2 focus:ring-teal-700 disabled:opacity-60">Annuler</button>
          <button type="submit" disabled={busy} className="min-h-12 rounded-lg bg-teal-700 px-4 font-semibold text-white hover:bg-teal-800 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:opacity-60">{busy ? "Enregistrement…" : "Envoyer la contestation"}</button>
        </div>
      </form>}
    </dialog>
  </div>;
}
