import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicLanding from "../../../components/PublicLanding";
import generatedContent from "../../../data/content-renovation-78.json";
import { buildCityCatalogue } from "../../../data/local-cities";

const cities = buildCityCatalogue(generatedContent, "renovation");

type LocalPageProps = { params: Promise<{ slug: string }> };

async function getCity(slug: string) {
  const city = cities.find((city) => city.slug === slug);
  if (!city) notFound();
  return city;
}

export async function generateStaticParams() {
  return cities.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: LocalPageProps): Promise<Metadata> {
  const city = await getCity((await params).slug);
  const title = `Rénovation ${city.name} (${city.postalCode}) : Devis & Artisans Locaux`;
  const description = `Travaux et rénovation à ${city.name} (${city.postalCode}) : 2 devis maximum d’artisans locaux, sans spam. Réponse sous 24h.`;
  return {
    title,
    description,
    robots: city.hasGeneratedContent ? undefined : { index: false, follow: true },
    openGraph: { title, description, type: "website", locale: "fr_FR" },
  };
}

export default async function LocalRenovationPage({ params }: LocalPageProps) {
  const city = await getCity((await params).slug);
  return <PublicLanding vertical="renovation" city={city} />;
}
