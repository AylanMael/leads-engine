"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FormProvider, useForm, useWatch, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LeadRenovationSchema, type LeadRenovation } from "../types/lead-renovation";
import { useTenantConfig } from "./TenantProvider";
import { isFirebaseConfigured } from "../lib/firebase";
import { departmentFromPostalCode } from "../lib/address";
import LocationFields from "./LocationFields";
import PhoneField from "./PhoneField";
import SocialProofBadge from "./SocialProofBadge";
import { saveLead } from "../lib/leads";

// Le choix locataire existe dans l'interface, mais le contrat final le refuse.
const FormSchema = LeadRenovationSchema.extend({
  property: LeadRenovationSchema.shape.property.extend({
    occupancyStatus: z.enum(["proprietaire_occupant", "proprietaire_bailleur", "futur_acquereur", "locataire"]),
  }),
}).pipe(LeadRenovationSchema);
type FormInput = z.input<typeof FormSchema>;
type Field = {
  name: FieldPath<FormInput>;
  label: string;
  options?: { value: string; label: string }[];
  type?: "text" | "number" | "tel" | "email";
  autoComplete?: string;
};

const steps: { title: string; fields: Field[] }[] = [
  { title: "Projet", fields: [
    { name: "geo.departureCity", label: "Commune du chantier", autoComplete: "address-level2" },
    { name: "geo.departurePostalCode", label: "Code postal du chantier", autoComplete: "postal-code" },
    { name: "projectType", label: "Quels travaux envisagez-vous ?", options: [
      { value: "globale", label: "Rénovation globale" },
      { value: "salle-de-bain", label: "Salle de bain" },
      { value: "cuisine", label: "Cuisine" },
      { value: "menuiserie", label: "Menuiserie" },
      { value: "isolation", label: "Isolation" },
    ] },
  ] },
  { title: "Logement / Budget", fields: [
    { name: "property.occupancyStatus", label: "Votre statut", options: [
      { value: "proprietaire_occupant", label: "Propriétaire occupant" },
      { value: "proprietaire_bailleur", label: "Propriétaire bailleur" },
      { value: "futur_acquereur", label: "Futur acquéreur" },
      { value: "locataire", label: "Locataire" },
    ] },
    { name: "property.buildingType", label: "Type de bâti", options: [
      { value: "maison", label: "Maison" }, { value: "appartement", label: "Appartement" },
    ] },
    { name: "property.surface", label: "Surface concernée (m²)", type: "number" },
    { name: "budgetBracket", label: "Budget estimé", options: [
      { value: "< 10k", label: "Moins de 10 000 €" }, { value: "10k-30k", label: "10 000 à 30 000 €" },
      { value: "30k-60k", label: "30 000 à 60 000 €" }, { value: "> 60k", label: "Plus de 60 000 €" },
    ] },
  ] },
  { title: "Coordonnées", fields: [
    { name: "customer.salutation", label: "Civilité", autoComplete: "honorific-prefix", options: [
      { value: "madame", label: "Madame" }, { value: "monsieur", label: "Monsieur" },
    ] },
    { name: "customer.firstName", label: "Prénom", autoComplete: "given-name" },
    { name: "customer.lastName", label: "Nom", autoComplete: "family-name" },
    { name: "customer.phone", label: "Téléphone", type: "tel", autoComplete: "tel" },
    { name: "customer.email", label: "E-mail", type: "email", autoComplete: "email" },
  ] },
];

const controlClass = "mt-2 min-h-12 min-w-0 w-full rounded-xl border border-slate-300 bg-slate-50/50 px-3 py-2 text-base text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2 aria-[invalid=true]:border-red-700";
const buttonClass = "min-h-12 rounded-xl px-5 py-3 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

type LeadFormRenovationProps = {
  defaultCity?: string;
  defaultPostalCode?: string;
};

export default function LeadFormRenovation({ defaultCity = "", defaultPostalCode = "" }: LeadFormRenovationProps = {}) {
  const [step, setStep] = useState(0);
  const [success, setSuccess] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const pending = useRef(false);
  const focusHeading = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const id = useId();
  const { theme } = useTenantConfig();
  const methods = useForm<FormInput, unknown, LeadRenovation>({
    resolver: zodResolver(FormSchema),
    mode: "onTouched",
    shouldUnregister: false,
    defaultValues: {
      vertical: "renovation",
      geo: { departureCity: defaultCity.trim(), departurePostalCode: defaultPostalCode.trim(), departureDepartment: departmentFromPostalCode(defaultPostalCode.trim()), departureStreetAddress: "" },
      customer: { firstName: "", lastName: "", phone: "", email: "" },
    },
  });
  const { register, control, trigger, handleSubmit, getFieldState, formState, setError, clearErrors } = methods;
  const activeCity = useWatch({ control, name: "geo.departureCity" });
  const isTenant = useWatch({ control, name: "property.occupancyStatus" }) === "locataire";
  const busy = advancing || formState.isSubmitting;
  const submissionError = formState.errors.root?.submission?.message;

  useEffect(() => {
    if (focusHeading.current) {
      headingRef.current?.focus();
      focusHeading.current = false;
    }
  }, [step, success]);

  useEffect(() => {
    if (submissionError && !busy) errorRef.current?.focus();
  }, [submissionError, busy]);

  function goToStep(next: number) {
    clearErrors("root");
    focusHeading.current = true;
    setStep(next);
  }

  async function submit(data: LeadRenovation) {
    try {
      const result = await saveLead(data);
      if (!result.success) {
        setError("root.submission", { message: result.error ?? "L’envoi a échoué. Veuillez réessayer." });
        return;
      }
      focusHeading.current = true;
      setSuccess(true);
    } catch {
      setError("root.submission", { message: "L’envoi a échoué. Vos informations sont conservées, veuillez réessayer." });
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="mx-auto max-w-2xl rounded-2xl bg-white p-5 text-slate-900 sm:p-8">
      {success ? (
        <div className="py-8 text-center">
          <h2 ref={headingRef} id={`${id}-heading`} tabIndex={-1} className="text-2xl font-bold focus:outline-none">Merci pour votre demande !</h2>
          <p className="mt-4 text-slate-700">Un artisan local vous contactera sous 24h pour échanger sur votre projet de rénovation.</p>
          {!isFirebaseConfigured && <p className="mt-4 text-sm text-slate-600">Mode démonstration : aucune demande n’a été transmise.</p>}
        </div>
      ) : (
        <>
          <nav aria-label="Étapes du formulaire" className="mb-8">
            <p aria-live="polite" aria-atomic="true" className={`mb-3 text-sm font-semibold ${theme.accent}`}>Étape {step + 1} sur 3 : {steps[step].title}</p>
            <progress aria-label="Avancement du formulaire" value={step + 1} max={3} className="h-2 w-full accent-emerald-700" />
            <ol className="mt-3 grid grid-cols-3 gap-2 text-sm">
              {steps.map((item, index) => <li key={item.title} aria-current={index === step ? "step" : undefined} className={index === step ? `font-bold ${theme.accent}` : "text-slate-600"}>{item.title}</li>)}
            </ol>
          </nav>
          <h2 ref={headingRef} id={`${id}-heading`} tabIndex={-1} className="text-2xl font-bold focus:outline-none">{steps[step].title}</h2>
          <p className="mt-2 text-sm text-slate-600">Tous les champs sont obligatoires.</p>
          <FormProvider {...methods}>
          <form noValidate aria-busy={busy} className="mt-6" onSubmit={async (event) => {
            event.preventDefault();
            if (pending.current || (step > 0 && isTenant)) return;
            pending.current = true;
            clearErrors("root");
            try {
              if (step < 2) {
                setAdvancing(true);
                if (await trigger(steps[step].fields.map(({ name }) => name), { shouldFocus: true })) goToStep(step + 1);
                else if (step === 0) requestAnimationFrame(() => document.getElementById(getFieldState("geo.departureCity").invalid || getFieldState("geo.departurePostalCode").invalid ? "location-departure" : "location-arrival")?.focus());
              } else {
                await handleSubmit(submit, (errors) => {
                  const invalidStep = steps.findIndex((item) => item.fields.some(({ name }) => getFieldState(name, { ...formState, errors }).invalid));
                  if (invalidStep >= 0 && invalidStep !== step) goToStep(invalidStep);
                })();
              }
            } finally {
              pending.current = false;
              setAdvancing(false);
            }
          }}>
            <fieldset disabled={busy} className="grid min-w-0 grid-cols-1 gap-5 sm:grid-cols-2">
              <legend className="sr-only">{steps[step].title}</legend>
              {step === 0 && <LocationFields kind="departure" label="Commune ou adresse du chantier" />}
              {steps[step].fields.filter((field) => !field.name.startsWith("geo.")).map((field) => {
                if (field.name === "customer.phone") return <PhoneField key={field.name} />;
                const fieldId = `${id}-${field.name}`;
                const error = getFieldState(field.name, formState).error;
                const blocked = field.name === "property.occupancyStatus" && isTenant;
                const accessibility = { id: fieldId, "aria-invalid": Boolean(error) || blocked, "aria-describedby": blocked ? `${id}-tenant-message` : error ? `${fieldId}-error` : undefined };
                return (
                  <div key={field.name} className="min-w-0">
                    <label htmlFor={fieldId} className="font-medium">{field.label}</label>
                    {field.options ? (
                      <select {...register(field.name)} {...accessibility} required defaultValue="" autoComplete={field.autoComplete} className={controlClass}>
                        <option value="" disabled>Choisir une option</option>
                        {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    ) : (
                      <input {...register(field.name, { valueAsNumber: field.type === "number" })} {...accessibility} required type={field.type ?? "text"} step={field.type === "number" ? "any" : undefined} autoComplete={field.autoComplete} className={controlClass} />
                    )}
                    {error && !blocked && <p id={`${fieldId}-error`} role="alert" className="mt-2 text-sm text-red-700">{error.message}</p>}
                  </div>
                );
              })}
            </fieldset>
            {step === 1 && isTenant && <p id={`${id}-tenant-message`} role="alert" className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">Vous êtes locataire : l’accord du propriétaire est requis avant toute demande de devis. Ce formulaire est réservé aux propriétaires et futurs acquéreurs. Invitez votre propriétaire à effectuer la demande.</p>}
            {submissionError && <p ref={errorRef} role="alert" tabIndex={-1} className="mt-5 rounded-xl bg-red-50 p-4 text-red-800 focus:outline-none focus:ring-2 focus:ring-red-700">{submissionError}</p>}
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              {step > 0 && <button type="button" disabled={busy} onClick={() => { if (!pending.current) goToStep(step - 1); }} className={`${buttonClass} border border-slate-400 hover:bg-slate-50 focus-visible:ring-emerald-700`}>Retour</button>}
              <button type="submit" disabled={busy || (step > 0 && isTenant)} className={`${buttonClass} ${theme.button} sm:ml-auto`}>{formState.isSubmitting ? "Envoi en cours…" : advancing ? "Vérification…" : step === 2 ? "Envoyer ma demande" : "Suivant"}</button>
            </div>
            <SocialProofBadge city={activeCity} />
            <p className="mt-4 text-center text-xs leading-5 text-slate-500">Vos coordonnées sont réservées au traitement de votre demande, avec 2 professionnels maximum. <a href="#mentions-legales" className="underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-700">Gestion de vos données</a></p>
            <p role="status" className="sr-only">{formState.isSubmitting ? "Envoi de votre demande en cours." : ""}</p>
          </form>
          </FormProvider>
        </>
      )}
    </section>
  );
}
