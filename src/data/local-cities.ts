import "server-only";
import { z } from "zod";
import extractedCities from "./cities-78.json";
import { MOCK_CITIES } from "./mock-cities";
import { validateCatalogue } from "../lib/city-content.mjs";
import type { City } from "../types/city";

const geographySchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1),
  postalCode: z.string().regex(/^[0-9]{5}$/),
  departmentCode: z.literal("78"),
  departmentName: z.string().min(1),
}));

export type LocalContentCity = City & { headline: string; hasGeneratedContent: boolean };

/** Même objet FAQ pour la page et son JSON-LD ; données contrôlées au build. */
export function buildCityCatalogue(rawContent: unknown, vertical: "demenagement" | "renovation"): LocalContentCity[] {
  const cities = geographySchema.parse(extractedCities.length ? extractedCities : MOCK_CITIES);
  const contents = validateCatalogue(rawContent, vertical);
  const slugs = new Set(cities.map(({ slug }) => slug));
  if (slugs.size !== cities.length) throw new Error("Slugs de communes dupliqués");
  if (contents.some(({ slug }) => !slugs.has(slug))) throw new Error("Contenu associé à une commune inconnue");
  const contentBySlug = new Map(contents.map((content) => [content.slug, content]));
  return cities.map((city) => {
    const content = contentBySlug.get(city.slug);
    const mock = MOCK_CITIES.find(({ slug }) => slug === city.slug);
    const label = vertical === "renovation" ? "Rénovation" : "Déménagement";
    return {
      ...city,
      headline: content?.headline ?? `${label} à ${city.name} : préparez votre projet`,
      hasGeneratedContent: Boolean(content),
      context: {
        housingType: `${label} de votre maison ou appartement à ${city.name} (${city.postalCode}). Décrivez votre projet pour être mis en relation avec des professionnels locaux.`,
        trafficNote: content?.accessNotice ?? "Les conseils propres à cette commune sont en préparation. Précisez votre adresse et vos contraintes d’accès au professionnel avant de fixer l’organisation du projet.",
        neighborhoods: mock?.context.neighborhoods ?? [],
      },
      faq: content?.faq ?? [],
    };
  });
}
