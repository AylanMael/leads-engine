import { getSiteConfig } from "../config/site";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteConfig().domain;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/_next/", "/admin", "/partenaire"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
