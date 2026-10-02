import { getSiteConfig, getCanonicalUrl, getOrganization } from "../config/site";
import type { City } from "../types/city";

type CityJsonLdProps = {
  city: City;
  vertical?: "demenagement" | "renovation";
};

/** Données structurées rendues côté serveur, à partir du contenu de la page. */
export default function CityJsonLd({ city, vertical = "demenagement" }: CityJsonLdProps) {
  const site = getSiteConfig(vertical);
  const canonical = getCanonicalUrl(site, city.slug);
  const organization = getOrganization(site);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      organization,
      {
        "@type": "Service",
        "@id": `${canonical}#service`,
        url: canonical,
        provider: { "@id": organization["@id"] },
        brand: { "@type": "Brand", name: site.brandName, url: site.domain },
        name: `${vertical === "renovation" ? "Rénovation de l’habitat" : "Déménagement"} à ${city.name}`,
        serviceType: vertical === "renovation" ? "Rénovation de l’habitat" : "Déménagement de particuliers et entreprises",
        areaServed: {
          "@type": "City",
          name: city.name,
          address: {
            "@type": "PostalAddress",
            addressLocality: city.name,
            postalCode: city.postalCode,
            addressRegion: city.departmentName,
            addressCountry: "FR",
          },
        },
      },
      ...(city.faq.length ? [{
        "@type": "FAQPage",
        "@id": `${canonical}#faq`,
        url: canonical,
        mainEntity: city.faq.map(({ question, answer }) => ({
          "@type": "Question",
          name: question,
          acceptedAnswer: {
            "@type": "Answer",
            text: answer,
          },
        })),
      }] : []),
    ],
  };

  // Neutralise notamment </script> sans modifier les valeurs JSON décodées.
  const serialized = JSON.stringify(jsonLd).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serialized }}
    />
  );
}
