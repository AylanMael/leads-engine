import PublicLanding from "../components/PublicLanding";
import { getSiteConfig, getCanonicalUrl } from "../config/site";

export function generateMetadata() {
  const site = getSiteConfig();
  return { alternates: { canonical: getCanonicalUrl(site) }, openGraph: { title: `${site.brandName} | ${site.tagline}`, description: site.description, siteName: site.brandName, url: getCanonicalUrl(site), type: "website" as const, locale: "fr_FR" } };
}

export default function HomePage() {
  return <PublicLanding vertical={getSiteConfig().vertical} />;
}
