import { getSiteConfig } from "../config/site";
import Link from "next/link";
import { DEPARTMENTS } from "../data/cities";
import type { TenantConfig } from "../config/tenant";

const featured: Record<string, string[]> = {
  "78": ["Versailles", "Sartrouville", "Saint-Germain-en-Laye", "Poissy", "Mantes-la-Jolie", "Conflans-Sainte-Honorine", "Montigny-le-Bretonneux", "Houilles"],
  "92": ["Boulogne-Billancourt", "Nanterre", "Neuilly-sur-Seine", "Levallois-Perret", "Courbevoie", "Asnières-sur-Seine", "Rueil-Malmaison", "Issy-les-Moulineaux"],
  "75": ["Paris 15e Arrondissement", "Paris 17e Arrondissement", "Paris 18e Arrondissement", "Paris 11e Arrondissement", "Paris 16e Arrondissement", "Paris 12e Arrondissement", "Paris 20e Arrondissement", "Paris 9e Arrondissement"],
};

export default function Footer({ vertical }: { vertical: TenantConfig["vertical"] }) {
  const site = getSiteConfig(vertical);
  return <footer className="bg-slate-900 text-slate-300">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
      <p className="text-xl font-semibold tracking-tight text-white">{site.brandName}</p>
      <p className="mt-3 text-sm leading-6">{site.tagline} · Paris et ouest francilien</p>
      <nav aria-label="Nos zones couvertes" className="mt-8 grid gap-8 sm:grid-cols-3">
        {DEPARTMENTS.map((department) => <div key={department.code}>
          <h2 className="mb-3 text-sm font-semibold text-white">{department.name} ({department.code})</h2>
          <ul>{featured[department.code].map((name) => department.cities.find((city) => city.name === name)).filter((city) => city !== undefined).map((city) => <li key={city.slug}><Link href={`/${vertical}/${city.slug}`} className="inline-block rounded py-2 text-xs leading-5 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-emerald-300">{city.name}</Link></li>)}</ul>
        </div>)}
      </nav>
      <Link href={vertical === getSiteConfig().vertical ? "/communes" : `${site.domain}/communes`} className="mt-7 inline-block rounded text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-emerald-300">Toutes nos communes couvertes</Link>
      <div className="mt-10 border-t border-slate-700 pt-6 text-xs leading-6"><div className="flex flex-wrap items-center justify-between gap-4"><p>© {new Date().getFullYear()} {site.brandName} · {site.badge}</p><Link href="/partenaire/login" className="rounded text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-emerald-300">Espace Partenaire Pro</Link></div>
        <details id="mentions-legales" className="mt-4"><summary className="w-fit cursor-pointer rounded font-medium text-white focus-visible:outline-2 focus-visible:outline-emerald-300">Mentions légales & données personnelles</summary><div className="mt-4 max-w-3xl space-y-3 text-slate-300"><p><strong className="text-white">Éditeur :</strong> {site.legalName}. Site : <a href={site.domain} className="underline">{site.domain}</a>. Adresse du siège et SIREN/SIRET à compléter. Contact du projet : <a href="mailto:contact@vsw-digital.fr" className="underline">contact@vsw-digital.fr</a>.</p><p><strong className="text-white">Hébergement :</strong> Google Cloud / Firebase App Hosting, région Europe (europe-west4). Base Firestore en Europe (europe-west9).</p><p><strong className="text-white">Vos données :</strong> les informations de votre demande servent à vous mettre en relation avec au maximum 2 professionnels concernés. Vous pouvez contacter l’éditeur pour demander l’accès, la rectification ou la suppression de vos données. Vos coordonnées ne doivent pas être revendues par les professionnels destinataires.</p></div></details>
      </div>
    </div>
  </footer>;
}
