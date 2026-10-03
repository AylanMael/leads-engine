import { getSiteConfig } from "../config/site";
import Link from "next/link";
import { ArrowUpRight, House, Truck } from "lucide-react";
import type { TenantConfig } from "../config/tenant";

export default function Header({ vertical }: { vertical: TenantConfig["vertical"] }) {
  const site = getSiteConfig(vertical);
  const renovation = vertical === "renovation";
  const Icon = renovation ? House : Truck;
  return <header className="border-b border-slate-200/80 bg-white">
    <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-lg focus:bg-white focus:p-4">Aller au contenu</a>
    <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-8">
      <Link href={site.vertical === getSiteConfig().vertical ? "/" : site.domain} className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-700" aria-label={`${site.brandName} — Accueil`}>
        <span className="hidden rounded-xl bg-slate-900 p-2.5 text-white min-[380px]:block"><Icon size={23} aria-hidden="true" /></span>
        <span><span className="flex items-center gap-2 text-base font-bold tracking-tight sm:text-xl">{site.brandName}<span className="rounded-md bg-emerald-100 px-2 py-1 text-xs text-emerald-900">IDF</span></span><span className="mt-1 hidden text-xs text-slate-500 lg:block">{site.badge} — Île-de-France</span></span>
      </Link>
      <Link href="/partenaire/login" aria-label="Espace Partenaire Pro" className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700 sm:px-3 sm:text-sm"><span className="sm:hidden">Espace Pro</span><span className="hidden sm:inline">Espace Partenaire Pro</span><ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>
  </header>;
}
