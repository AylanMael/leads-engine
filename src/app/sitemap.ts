import type { MetadataRoute } from "next";
import { MOCK_CITIES } from "../data/mock-cities";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
  const lastModified = new Date();

  return [
    {
      url: `${baseUrl}/`,
      priority: 1.0,
      changeFrequency: "weekly",
    },
    ...MOCK_CITIES.map((city): MetadataRoute.Sitemap[number] => ({
      url: `${baseUrl}/demenagement/${city.slug}`,
      priority: 0.8,
      changeFrequency: "monthly",
      lastModified,
    })),
  ];
}
