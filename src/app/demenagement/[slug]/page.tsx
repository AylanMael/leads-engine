import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicLanding from "../../../components/PublicLanding";
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

  return <PublicLanding vertical="demenagement" city={city} />;
}
