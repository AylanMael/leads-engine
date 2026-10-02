import type { ReactNode } from "react";
import { Check, MapPin, ArrowDownRight } from "lucide-react";
import type { City } from "../types/city";
import type { TenantConfig } from "../config/tenant";

export default function LocalHero({ city, vertical, children }: { city?: City; vertical: TenantConfig["vertical"]; children: ReactNode }) {
  const renovation = vertical === "renovation";
  return <section className="relative mx-auto grid max-w-7xl items-start gap-10 px-4 pb-14 pt-9 sm:px-8 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:py-20">
    <div className="min-w-0 lg:pt-7">
      <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold tracking-wide text-emerald-900"><MapPin size={14} aria-hidden="true" />{city ? `${city.name} · ${city.postalCode}` : "Yvelines · 78"}</p>
      <h1 className="max-w-xl text-[2.25rem] font-semibold leading-[1.12] tracking-[-0.045em] text-slate-900 sm:text-5xl lg:text-[3.5rem]">
        {city ? <>Trouvez {renovation ? "votre artisan" : "votre déménageur"}<span className="block text-emerald-800">à {city.name}.</span><span className="mt-3 block text-lg font-medium tracking-normal text-slate-500">{city.postalCode} · Yvelines</span></> : <>{renovation ? "Vos travaux méritent" : "Déménagez avec"}<span className="block text-emerald-800">le bon professionnel.</span></>}
      </h1>
      <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">{renovation ? "Un projet de rénovation" : "Un déménagement"}, une seule demande. Échangez avec jusqu’à <strong className="font-semibold text-slate-900">2 professionnels locaux</strong> et choisissez sereinement, sans multiplier les appels.</p>
      <ul className="mt-7 space-y-3 text-sm font-medium text-slate-700">
        {["Demande de devis 100 % gratuite", "Prise de contact prévue sous 24 h", "Sans engagement, vous restez libre"].map((label) => <li key={label} className="flex items-center gap-3"><span className="rounded-full bg-emerald-100 p-1 text-emerald-800"><Check size={14} aria-hidden="true" /></span>{label}</li>)}
      </ul>
      <div className="mt-9 flex max-w-md items-center gap-5 border-t border-slate-200 pt-6"><span className="text-5xl font-semibold tracking-tighter text-slate-900">2<span className="text-emerald-700">.</span></span><p className="text-sm leading-6 text-slate-600"><strong className="block font-semibold text-slate-900">Professionnels maximum par demande.</strong>Moins de sollicitations. Plus de temps pour choisir.</p></div>
      {city && city.context.neighborhoods.length > 0 && <p className="mt-5 text-xs leading-6 text-slate-500">Dans votre secteur : {city.context.neighborhoods.join(" · ")}.</p>}
      <p className="mt-8 hidden items-center gap-3 text-sm font-semibold text-emerald-800 lg:flex">Commençons par votre projet <ArrowDownRight size={24} aria-hidden="true" /></p>
    </div>
    <div id="demande-devis" className="min-w-0 scroll-mt-6 rounded-2xl border border-slate-200 bg-white shadow-[0_16px_60px_-24px_rgba(15,23,42,0.2)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4 sm:px-8"><span className="text-sm font-semibold">Votre projet, en 3 étapes</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Gratuit & sans engagement</span></div>
      {children}
    </div>
  </section>;
}
