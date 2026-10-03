import type { MetadataRoute } from "next";
import { ALL_CITIES as cities } from "../data/cities";
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
    { url: `${site.domain}/communes`, priority: 0.7, changeFrequency: "monthly" },
    ...cities.map((city): MetadataRoute.Sitemap[number] => ({
      url: getCanonicalUrl(site, city.slug),
      priority: 0.8,
      changeFrequency: "monthly",
      lastModified,
    })),
  ];
}
