import type { MetadataRoute } from "next";
import cities from "../data/cities-78.json";
import { getSiteConfig, getCanonicalUrl } from "../config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = getSiteConfig();
  const lastModified = new Date();

  return [
    {
      url: getCanonicalUrl(site),
      priority: 1.0,
      changeFrequency: "weekly",
    },
    ...cities.map((city): MetadataRoute.Sitemap[number] => ({
      url: getCanonicalUrl(site, city.slug),
      priority: 0.8,
      changeFrequency: "monthly",
      lastModified,
    })),
  ];
}
