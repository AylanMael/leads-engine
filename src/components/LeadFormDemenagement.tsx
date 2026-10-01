"use client";

import { useEffect, useId, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type FieldPath } from "react-hook-form";
import { z } from "zod";
import { LeadDemenagementSchema, type LeadDemenagement } from "../types/lead";
import { saveLead } from "../lib/leads";
import { isFirebaseConfigured } from "../lib/firebase";

// L'entrée autorise l'absence de vertical ; le resolver applique sa valeur par défaut.
type LeadInput = z.input<typeof LeadDemenagementSchema>;
type Field = {
  name: FieldPath<LeadInput>;
  label: string;
  error: string;
  type?: "text" | "number" | "date" | "tel" | "email" | "checkbox" | "select";
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "email";
  min?: number;
  maxLength?: number;
  hint?: string;
};

const steps: { title: string; description: string; fields: Field[] }[] = [
  {
    title: "Trajet",
    description: "D’où partez-vous et où déménagez-vous ?",
    fields: [
      { name: "geo.departurePostalCode", label: "Code postal de départ", inputMode: "numeric", maxLength: 5, autoComplete: "section-departure postal-code", error: "Saisissez un code postal à 5 chiffres." },
      { name: "geo.departureCity", label: "Ville de départ", autoComplete: "section-departure address-level2", error: "Indiquez la ville de départ." },
      { name: "geo.arrivalPostalCode", label: "Code postal d’arrivée", inputMode: "numeric", maxLength: 5, autoComplete: "section-arrival postal-code", error: "Saisissez un code postal à 5 chiffres." },
      { name: "geo.arrivalCity", label: "Ville d’arrivée", autoComplete: "section-arrival address-level2", error: "Indiquez la ville d’arrivée." },
    ],
  },
  {
    title: "Volumes et accès",
    description: "Quelques précisions pour préparer votre déménagement.",
    fields: [
      { name: "projectDetails.housingType", label: "Type de logement", type: "select", error: "Sélectionnez un type de logement." },
      { name: "projectDetails.surface", label: "Surface (m²)", type: "number", min: 9, error: "Indiquez une surface d’au moins 9 m²." },
      { name: "projectDetails.departureFloor", label: "Étage de départ", type: "number", min: 0, hint: "0 pour le rez-de-chaussée.", error: "Indiquez un étage supérieur ou égal à 0." },
      { name: "projectDetails.arrivalFloor", label: "Étage d’arrivée", type: "number", min: 0, hint: "0 pour le rez-de-chaussée.", error: "Indiquez un étage supérieur ou égal à 0." },
      { name: "projectDetails.departureElevator", label: "Ascenseur au départ", type: "checkbox", error: "Précisez la présence d’un ascenseur au départ." },
      { name: "projectDetails.arrivalElevator", label: "Ascenseur à l’arrivée", type: "checkbox", error: "Précisez la présence d’un ascenseur à l’arrivée." },
      { name: "projectDetails.targetDate", label: "Date souhaitée", type: "date", error: "Indiquez la date souhaitée." },
    ],
  },
  {
    title: "Coordonnées",
    description: "Comment l’artisan local peut-il vous joindre ?",
    fields: [
      { name: "customer.firstName", label: "Prénom", autoComplete: "given-name", error: "Indiquez votre prénom." },
      { name: "customer.lastName", label: "Nom", autoComplete: "family-name", error: "Indiquez votre nom." },
      { name: "customer.phone", label: "Téléphone mobile", type: "tel", inputMode: "tel", autoComplete: "tel", hint: "Sans espaces : 0612345678 ou +33612345678 (06 ou 07).", error: "Saisissez un mobile en 06 ou 07 : 10 chiffres ou format +33, sans espaces." },
      { name: "customer.email", label: "E-mail", type: "email", inputMode: "email", autoComplete: "email", error: "Saisissez une adresse e-mail valide." },
    ],
  },
];

const controlClass = "mt-2 block min-h-12 w-full rounded-xl border border-slate-400 bg-white px-3 py-2 text-base text-slate-950 shadow-sm focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 aria-[invalid=true]:border-red-700 disabled:opacity-60";
const buttonClass = "min-h-12 rounded-xl px-5 py-3 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60";

type LeadFormDemenagementProps = {
  defaultCity?: string;
  defaultPostalCode?: string;
};

export default function LeadFormDemenagement({
  defaultCity = "",
  defaultPostalCode = "",
}: LeadFormDemenagementProps) {
  const [departureLocked, setDepartureLocked] = useState(
    () => Boolean(defaultCity.trim() && defaultPostalCode.trim()),
  );
  const [step, setStep] = useState(0);
  const [success, setSuccess] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submitErrorRef = useRef<HTMLParagraphElement>(null);
  const actionPending = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const id = useId();
  const { register, trigger, handleSubmit, getFieldState, setFocus, formState } = useForm<LeadInput, unknown, LeadDemenagement>({
    resolver: zodResolver(LeadDemenagementSchema),
    mode: "onTouched",
    shouldUnregister: false,
    defaultValues: {
      vertical: "demenagement",
      geo: {
        departurePostalCode: defaultPostalCode.trim(),
        departureCity: defaultCity.trim(),
        arrivalPostalCode: "",
        arrivalCity: "",
      },
      projectDetails: { departureElevator: false, arrivalElevator: false, targetDate: "" },
      customer: { firstName: "", lastName: "", phone: "", email: "" },
    },
  });
  const busy = advancing || formState.isSubmitting;
  const current = steps[step];

  useEffect(() => {
    if (focusHeading.current) {
      headingRef.current?.focus();
      focusHeading.current = false;
    }
  }, [step, success]);

  useEffect(() => {
    if (submitError && !busy) submitErrorRef.current?.focus();
  }, [submitError, busy]);

  function goToStep(next: number) {
    setSubmitError(null);
    focusHeading.current = true;
    setStep(next);
  }

  async function submit(data: LeadDemenagement) {
    setSubmitError(null);
    try {
      const result = await saveLead(data);
      if (!result.success) {
        setSubmitError(result.error ?? "Votre demande n’a pas pu être enregistrée. Veuillez réessayer.");
        return;
      }
      focusHeading.current = true;
      setSuccess(true);
    } catch {
      setSubmitError("Une erreur inattendue est survenue. Vos informations sont conservées, veuillez réessayer.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-sm sm:p-8" aria-labelledby={`${id}-heading`}>
      {success ? (
        <div className="py-8 text-center">
          <span aria-hidden="true" className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-3xl text-teal-800">✓</span>
          <h2 ref={headingRef} id={`${id}-heading`} tabIndex={-1} className="text-2xl font-bold focus:outline-none">Merci pour votre demande !</h2>
          <p className="mt-4 leading-relaxed text-slate-700">L’artisan local prendra contact avec vous sous 24h pour échanger sur votre déménagement.</p>
          {!isFirebaseConfigured && <p className="mt-4 text-sm text-slate-600">Mode démonstration : cet envoi est simulé, aucune demande n’a été transmise.</p>}
        </div>
      ) : (
        <>
          <nav aria-label="Étapes du formulaire" className="mb-8">
            <p className="mb-3 text-sm font-semibold text-teal-800" aria-live="polite" aria-atomic="true">Étape {step + 1} sur {steps.length} : {current.title}</p>
            <div role="progressbar" aria-label="Avancement du formulaire" aria-valuemin={0} aria-valuemax={3} aria-valuenow={step + 1} aria-valuetext={`Étape ${step + 1} sur 3`} className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-teal-700 transition-[width] motion-reduce:transition-none" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
            </div>
            <ol className="mt-3 grid grid-cols-3 gap-3 text-xs sm:text-sm">
              {steps.map((item, index) => (
                <li key={item.title} aria-current={index === step ? "step" : undefined} className={index === step ? "font-bold text-teal-800" : "text-slate-600"}>
                  <span aria-hidden="true">{index < step ? "✓" : index + 1}. </span>{item.title}
                </li>
              ))}
            </ol>
          </nav>

          <h2 ref={headingRef} id={`${id}-heading`} tabIndex={-1} className="text-2xl font-bold focus:outline-none">{current.title}</h2>
          <p className="mt-2 text-slate-600">{current.description}</p>
          <p className="mt-2 text-sm text-slate-600">Tous les champs sont obligatoires, sauf les cases ascenseur à cocher si présent.</p>

          <form noValidate aria-busy={busy} className="mt-6" onSubmit={async (event) => {
            event.preventDefault();
            if (actionPending.current) return;
            actionPending.current = true;
            try {
              if (step < steps.length - 1) {
                setAdvancing(true);
                if (await trigger(current.fields.map((field) => field.name), { shouldFocus: true })) goToStep(step + 1);
              } else {
                await handleSubmit(submit, (errors) => {
                  // Réafficher toute étape masquée qui comporte encore une erreur.
                  const invalidStep = steps.findIndex((item) => item.fields.some((field) => getFieldState(field.name, { ...formState, errors }).invalid));
                  if (invalidStep >= 0 && invalidStep !== step) goToStep(invalidStep);
                })();
              }
            } finally {
              actionPending.current = false;
              setAdvancing(false);
            }
          }}>
            {step === 0 && departureLocked && (
              <div className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-4">
                <p id={`${id}-departure-hint`} className="text-sm text-slate-700">
                  Votre ville de départ est pré-remplie depuis cette page locale.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  aria-controls={`${id}-geo.departureCity ${id}-geo.departurePostalCode`}
                  onClick={() => {
                    if (actionPending.current) return;
                    setDepartureLocked(false);
                    setFocus("geo.departureCity", { shouldSelect: true });
                  }}
                  className="mt-2 min-h-11 rounded-md text-left text-sm font-semibold text-teal-800 underline underline-offset-4 hover:text-teal-950 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                >
                  Modifier la ville de départ
                </button>
              </div>
            )}
            <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
              <legend className="sr-only">{current.title}</legend>
              {current.fields.map((field) => {
                const fieldId = `${id}-${field.name}`;
                const invalid = getFieldState(field.name, formState).invalid;
                // readOnly conserve les valeurs dans React Hook Form et dans l'envoi.
                const readOnly = departureLocked && (field.name === "geo.departureCity" || field.name === "geo.departurePostalCode");
                const describedBy = [readOnly ? `${id}-departure-hint` : null, field.hint ? `${fieldId}-hint` : null, invalid ? `${fieldId}-error` : null].filter(Boolean).join(" ") || undefined;
                const accessibility = { id: fieldId, "aria-invalid": invalid, "aria-describedby": describedBy };
                return (
                  <div key={field.name}>
                    {field.type === "checkbox" ? (
                      <label htmlFor={fieldId} className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-slate-300 px-3 py-3 font-medium">
                        <input {...register(field.name)} {...accessibility} type="checkbox" className="h-5 w-5 accent-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700 focus:ring-offset-2" />
                        {field.label}
                      </label>
                    ) : (
                      <>
                        <label htmlFor={fieldId} className="font-medium">{field.label}</label>
                        {field.type === "select" ? (
                          <select {...register(field.name)} {...accessibility} required defaultValue="" className={controlClass}>
                            <option value="" disabled>Choisir un type de logement</option>
                            <option value="appartement">Appartement</option>
                            <option value="maison">Maison</option>
                            <option value="bureau">Bureau</option>
                          </select>
                        ) : (
                          <input {...register(field.name, { valueAsNumber: field.type === "number" })} {...accessibility} readOnly={readOnly} required type={field.type ?? "text"} inputMode={field.inputMode} autoComplete={field.autoComplete} min={field.min} maxLength={field.maxLength} step={field.type === "number" ? "any" : undefined} className={`${controlClass} read-only:bg-slate-100 read-only:text-slate-700`} />
                        )}
                      </>
                    )}
                    {field.hint && <p id={`${fieldId}-hint`} className="mt-2 text-sm text-slate-600">{field.hint}</p>}
                    {invalid && <p id={`${fieldId}-error`} role="alert" className="mt-2 text-sm font-medium text-red-700">{field.error}</p>}
                  </div>
                );
              })}
            </fieldset>

            {submitError && (
              <p ref={submitErrorRef} role="alert" tabIndex={-1} className="mt-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-800 focus:outline-none focus:ring-2 focus:ring-red-700">
                {submitError}
              </p>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              {step > 0 && <button type="button" disabled={busy} onClick={() => { if (!actionPending.current) goToStep(step - 1); }} className={`${buttonClass} border border-slate-400 bg-white text-slate-800 hover:bg-slate-50`}>Retour</button>}
              <button type="submit" disabled={busy} className={`${buttonClass} bg-teal-700 text-white hover:bg-teal-800 sm:ml-auto`}>
                {formState.isSubmitting ? "Envoi en cours…" : advancing ? "Vérification…" : step === steps.length - 1 ? "Envoyer ma demande" : "Suivant"}
              </button>
            </div>
            <p role="status" className="sr-only">{formState.isSubmitting ? "Envoi de votre demande en cours." : ""}</p>
          </form>
        </>
      )}
    </section>
  );
}
