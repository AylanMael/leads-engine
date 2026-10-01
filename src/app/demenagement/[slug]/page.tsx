import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CityJsonLd from "../../../components/CityJsonLd";
import LeadFormDemenagement from "../../../components/LeadFormDemenagement";
import generatedContent from "../../../data/content-demenagement-78.json";
import { buildCityCatalogue } from "../../../data/local-cities";

const cities = buildCityCatalogue(generatedContent, "demenagement");

type LocalPageProps = {
  params: Promise<{ slug: string }>;
};

function getCity(slug: string) {
  const city = cities.find((city) => city.slug === slug);
  if (!city) notFound();
  return city;
}

/** Les communes du catalogue sont pré-rendues au build. */
export function generateStaticParams() {
  return cities.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: LocalPageProps): Promise<Metadata> {
  const city = getCity((await params).slug);
  const title = `Déménagement ${city.name} (${city.postalCode}) : Devis & Déménageurs Locaux`;
  const description = `Déménagez à ${city.name} (${city.postalCode}) : jusqu’à 2 devis d’artisans locaux assurés, sans spam commercial. Réponse sous 24h.`;

  return {
    title,
    description,
    robots: city.hasGeneratedContent ? undefined : { index: false, follow: true },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "fr_FR",
    },
  };
}

// Aucun accès réseau ni état client : seul le formulaire est hydraté.
export default async function LocalMovingPage({ params }: LocalPageProps) {
  const city = getCity((await params).slug);

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <CityJsonLd city={city} />
      <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
        <p className="mb-4 text-sm font-semibold tracking-wide text-teal-800">
          {city.departmentName} ({city.departmentCode}) · {city.postalCode}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl sm:leading-tight">
          {city.headline}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl leading-relaxed text-slate-700 sm:text-lg">
          {city.context.housingType}
        </p>
        <p className="mt-4 font-medium text-teal-800">
          Artisans locaux assurés · 2 devis maximum · Sans spam commercial
        </p>
        {city.context.neighborhoods.length > 0 && <div className="mt-5">
          <p className="text-sm font-medium text-slate-700">Quartiers desservis, notamment :</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2" aria-label={`Quartiers desservis à ${city.name}`}>
            {city.context.neighborhoods.map((neighborhood) => (
              <li key={neighborhood} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700">
                {neighborhood}
              </li>
            ))}
          </ul>
        </div>}
      </header>

      <LeadFormDemenagement
        key={city.slug}
        defaultCity={city.name}
        defaultPostalCode={city.postalCode}
      />

      <section aria-labelledby="parking-heading" className="mx-auto mt-12 max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 sm:p-8">
        <h2 id="parking-heading" className="text-xl font-bold text-slate-950 sm:text-2xl">
          Stationnement et réservation d’emplacement à {city.name}
        </h2>
        <p className="mt-4 leading-relaxed text-slate-700">{city.context.trafficNote}</p>
      </section>

      {city.faq.length > 0 && <section aria-labelledby="faq-heading" className="mx-auto mt-12 max-w-2xl">
        <h2 id="faq-heading" className="text-2xl font-bold text-slate-950">
          Vos questions sur le déménagement à {city.name}
        </h2>
        <div className="mt-6 space-y-3">
          {city.faq.map(({ question, answer }) => (
            <details key={question} className="rounded-xl border border-slate-200 bg-white open:border-teal-700">
              <summary className="cursor-pointer rounded-xl p-5 font-semibold text-slate-900 marker:text-teal-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
                {question}
              </summary>
              <p className="px-5 pb-5 leading-relaxed text-slate-700">{answer}</p>
            </details>
          ))}
        </div>
      </section>}
    </main>
  );
}
