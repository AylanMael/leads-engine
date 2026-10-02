import { Info, Plus } from "lucide-react";
import type { LocalContentCity } from "../data/local-cities";
import type { TenantConfig } from "../config/tenant";

export default function LocalContent({ city, vertical }: { city: LocalContentCity; vertical: TenantConfig["vertical"] }) {
  return <section className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-8 sm:py-20 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
    <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Le regard local</p><h2 className="mt-4 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{city.headline}</h2><p className="mt-5 leading-7 text-slate-600">{city.context.housingType}</p>
      <aside className="mt-7 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6"><h3 className="flex items-start gap-3 font-semibold text-emerald-950"><Info className="mt-0.5 shrink-0" size={20} aria-hidden="true" />{vertical === "renovation" ? "Bien préparer votre chantier" : "Anticiper l’accès et le stationnement"}</h3><p className="mt-4 text-sm leading-7 text-slate-700">{city.context.trafficNote}</p></aside>
    </div>
    {city.faq.length > 0 && <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Vos questions</p><h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">{vertical === "renovation" ? "Rénover" : "Déménager"} à {city.name}</h2><div className="mt-7 space-y-3">{city.faq.map(({ question, answer }) => <details key={question} className="group rounded-xl border border-slate-200 bg-white open:border-emerald-300 open:shadow-sm"><summary className="flex cursor-pointer list-none items-start justify-between gap-5 rounded-xl p-5 text-sm font-semibold leading-6 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700 [&::-webkit-details-marker]:hidden">{question}<Plus size={18} aria-hidden="true" className="mt-1 shrink-0 text-emerald-800 transition-transform group-open:rotate-45 motion-reduce:transition-none" /></summary><p className="px-5 pb-5 text-sm leading-7 text-slate-600">{answer}</p></details>)}</div></div>}
  </section>;
}
