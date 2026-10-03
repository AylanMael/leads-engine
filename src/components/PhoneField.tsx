"use client";
import { useId } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { formatPhone, normalizePhone } from "../lib/phone";
export default function PhoneField() {
  const id = useId();
  const { control, trigger } = useFormContext<{ customer: { phone: string } }>();
  return <Controller control={control} name="customer.phone" render={({ field, fieldState }) => <div className="min-w-0 sm:col-span-2">
    <label htmlFor={id} className="font-medium">Téléphone</label>
    <input {...field} id={id} type="tel" inputMode="tel" autoComplete="tel" required
      value={formatPhone(field.value ?? "")} onChange={(event) => {
        const input = event.currentTarget;
        const raw = input.value;
        let caretDigits = raw.slice(0, input.selectionStart ?? raw.length).replace(/\D/g, "").length;
        let next = normalizePhone(raw);
        // Supprimer un espace du masque supprime aussi le chiffre précédent.
        if ((event.nativeEvent as InputEvent).inputType === "deleteContentBackward" && next === field.value && caretDigits > 0) {
          next = next.slice(0, caretDigits - 1) + next.slice(caretDigits);
          caretDigits -= 1;
        }
        field.onChange(next);
        if (next.length >= 10 || fieldState.error) void trigger("customer.phone");
        requestAnimationFrame(() => {
          const international = /^(?:\+33|0033)/.test(raw.replace(/[\s.()-]/g, ""));
          const caret = international ? formatPhone(next).length : Math.min(formatPhone(next).length, caretDigits + Math.max(0, Math.floor((caretDigits - 1) / 2)));
          if (document.activeElement === input) input.setSelectionRange(caret, caret);
        });
      }} aria-invalid={Boolean(fieldState.error)} aria-describedby={`${id}-hint${fieldState.error ? ` ${id}-error` : ""}`}
      className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-emerald-700 aria-[invalid=true]:border-red-700" />
    <p id={`${id}-hint`} className="mt-2 text-sm leading-5 text-slate-600">Aucun démarchage automatisé. Votre numéro sert exclusivement aux 2 professionnels sélectionnés pour planifier votre devis.</p>
    {fieldState.error && <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-700">{fieldState.error.message}</p>}
  </div>} />;
}
