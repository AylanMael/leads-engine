import Link from "next/link";
import cities from "../data/cities-78.json";
import type { TenantConfig } from "../config/tenant";

// Liens uniquement vers des communes présentes dans le catalogue pré-rendu.
const names = ["Versailles", "Sartrouville", "Saint-Germain-en-Laye", "Mantes-la-Jolie", "Poissy", "Conflans-Sainte-Honorine", "Montigny-le-Bretonneux", "Houilles", "Plaisir", "Chatou", "Trappes", "Les Mureaux", "Rambouillet", "Le Chesnay-Rocquencourt", "Guyancourt"];
const featuredCities = names.flatMap((name) => cities.find((city) => city.name === name) ?? []);

export default function Footer({ vertical }: { vertical: TenantConfig["vertical"] }) {
  return <footer className="bg-slate-900 text-slate-300">
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_2fr]"><div><p className="text-xl font-semibold tracking-tight text-white">{vertical === "renovation" ? "ProTravaux" : "Déménagement"} <span className="text-emerald-300">78</span></p><p className="mt-3 max-w-xs text-sm leading-6">Votre projet commence près de chez vous.<br />Une seule demande, jusqu’à 2 professionnels.</p></div><nav aria-label="Nos communes dans les Yvelines"><h2 className="mb-5 text-sm font-semibold text-white">À vos côtés dans les Yvelines</h2><ul className="grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-3">{featuredCities.map((city) => <li key={city.slug}><Link href={`/${vertical}/${city.slug}`} className="inline-block rounded py-2 text-xs leading-5 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-emerald-300">{city.name}</Link></li>)}</ul></nav></div>
      <div className="mt-10 border-t border-slate-700 pt-6 text-xs leading-6"><div className="flex flex-wrap items-center justify-between gap-4"><p>Comparateur local indépendant · Yvelines</p><Link href="/partenaire/login" className="rounded text-white underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-emerald-300">Espace Partenaire Pro</Link></div>
        <details id="mentions-legales" className="mt-4"><summary className="w-fit cursor-pointer rounded font-medium text-white focus-visible:outline-2 focus-visible:outline-emerald-300">Mentions légales & données personnelles</summary><div className="mt-4 max-w-3xl space-y-3 text-slate-300"><p><strong className="text-white">Éditeur :</strong> identité juridique, adresse du siège et SIREN/SIRET à compléter avant lancement commercial. Contact du projet : <a href="mailto:contact@vsw-digital.fr" className="underline">contact@vsw-digital.fr</a>.</p><p><strong className="text-white">Hébergement :</strong> Google Cloud / Firebase App Hosting, région Europe (europe-west4). Base Firestore en Europe (europe-west9).</p><p><strong className="text-white">Vos données :</strong> les informations de votre demande servent à vous mettre en relation avec au maximum 2 professionnels concernés. Vous pouvez contacter l’éditeur pour demander l’accès, la rectification ou la suppression de vos données. Vos coordonnées ne doivent pas être revendues par les professionnels destinataires.</p></div></details>
      </div>
    </div>
  </footer>;
}
