import { getSiteConfig, getCanonicalUrl } from "../../../config/site";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicLanding from "../../../components/PublicLanding";
import { getCityCatalogue } from "../../../data/local-cities";

const cities = getCityCatalogue( "demenagement");

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
  const site = getSiteConfig("demenagement");
  const canonical = getCanonicalUrl(site, city.slug);
  const title = `Déménagement ${city.name} (${city.postalCode}) : Devis & Déménageurs Locaux`;
  const description = `Déménagez à ${city.name} (${city.postalCode}) : jusqu’à 2 devis d’artisans locaux assurés, sans spam commercial. Réponse sous 24h.`;

  return {
    title: { absolute: `${title} | ${site.brandName}` },
    alternates: { canonical },
    description,
    robots: city.hasGeneratedContent ? undefined : { index: false, follow: true },
    openGraph: { siteName: site.brandName, url: canonical,
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
