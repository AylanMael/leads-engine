import Link from "next/link";
import { DEPARTMENTS } from "../../data/cities";
import { getSiteConfig } from "../../config/site";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

const site = getSiteConfig();
export const metadata = {
  title: "Toutes nos communes couvertes",
  description: "Retrouvez nos pages locales dans les Yvelines, les Hauts-de-Seine et les 20 arrondissements de Paris.",
  alternates: { canonical: `${site.domain}/communes` },
};

export default function CoveredCitiesPage() {
  return <><Header vertical={site.vertical} /><main id="contenu" className="mx-auto max-w-7xl px-4 py-12 sm:px-8">
    <h1 className="text-3xl font-semibold tracking-tight">Toutes nos communes couvertes</h1>
    <p className="mt-4 text-slate-600">{site.brandName} : trouvez les conseils utiles à votre projet, près de chez vous.</p>
    <div className="mt-10 grid gap-10 md:grid-cols-3">{DEPARTMENTS.map((department) => <section key={department.code}>
      <h2 className="text-xl font-semibold">{department.name} ({department.code})</h2>
      <ul className="mt-4 space-y-1">{department.cities.map((city) => <li key={city.slug}><Link href={`/${site.vertical}/${city.slug}`} className="inline-block rounded py-2 text-sm text-emerald-800 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-emerald-700">{city.name} ({city.postalCode})</Link></li>)}</ul>
    </section>)}</div>
  </main><Footer vertical={site.vertical} /></>;
}
