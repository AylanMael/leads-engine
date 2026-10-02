import PublicLanding from "../../components/PublicLanding";
import { getSiteConfig, getSiteMetadata, getCanonicalUrl } from "../../config/site";

const site = getSiteConfig("renovation");
export const metadata = { ...getSiteMetadata(site), title: { absolute: `${site.brandName} | ${site.tagline}` }, alternates: { canonical: getCanonicalUrl(site) }, openGraph: { ...getSiteMetadata(site).openGraph, url: getCanonicalUrl(site) } };

export default function RenovationPage() {
  return <PublicLanding vertical="renovation" />;
}
