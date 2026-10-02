import type { Metadata } from "next";

export type Vertical = "renovation" | "demenagement";
export type SiteConfig = Readonly<{
  vertical: Vertical;
  brandName: string;
  legalName: string;
  domain: string;
  tagline: string;
  description: string;
  badge: string;
}>;

const SITES = {
  renovation: {
    vertical: "renovation",
    brandName: "Rénovizo",
    legalName: "Rénovizo France",
    domain: "https://renovizo.fr",
    tagline: "Vos travaux de rénovation au juste prix",
    description: "Comparez jusqu'à 2 artisans locaux certifiés pour vos travaux de rénovation. Devis gratuit, sans engagement.",
    badge: "Comparateur travaux indépendant",
  },
  demenagement: {
    vertical: "demenagement",
    brandName: "Déménizo",
    legalName: "Déménizo France",
    domain: "https://demenizo.fr",
    tagline: "Votre déménagement en toute sérénité",
    description: "Trouvez un déménageur professionnel fiable et vérifié au meilleur tarif. Devis gratuit sous 24 h.",
    badge: "Comparateur déménagement indépendant",
  },
} as const satisfies Record<Vertical, SiteConfig>;

/** L'environnement sélectionne le déploiement ; une route locale peut préciser son métier. */
export function getSiteConfig(vertical: string | null | undefined = process.env.NEXT_PUBLIC_VERTICAL): SiteConfig {
  return vertical === "renovation" ? SITES.renovation : SITES.demenagement;
}

export function getCanonicalUrl(site: SiteConfig, slug?: string): string {
  return slug ? `${site.domain}/${site.vertical}/${encodeURIComponent(slug)}` : `${site.domain}/`;
}

export function getSiteMetadata(site: SiteConfig): Metadata {
  return {
    metadataBase: new URL(site.domain),
    title: { default: `${site.brandName} | ${site.tagline}`, template: `%s | ${site.brandName}` },
    description: site.description,
    openGraph: { title: `${site.brandName} | ${site.tagline}`, description: site.description, siteName: site.brandName, type: "website", locale: "fr_FR" },
  };
}

export function getOrganization(site: SiteConfig) {
  return { "@type": "Organization", "@id": `${site.domain}/#organization`, name: site.brandName, legalName: site.legalName, url: getCanonicalUrl(site), slogan: site.tagline };
}
