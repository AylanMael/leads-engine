import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cache } from "react";
import { z } from "zod";
import { MOCK_CITIES } from "./mock-cities";
import type { City } from "../types/city";

// Le fichier d’extraction contient des fiches dont le contenu éditorial reste à enrichir.
const geographySchema = z.array(z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1),
  postalCode: z.string().regex(/^[0-9]{5}$/),
  departmentCode: z.string().trim().min(1),
  departmentName: z.string().trim().min(1),
})).min(1);

/** Catalogue local sans appel réseau ; fallback uniquement si l’extraction est absente. */
export const getRenovationCities = cache(async (): Promise<City[]> => {
  let source: unknown;
  try {
    source = JSON.parse(await readFile(path.join(process.cwd(), "src/data/cities-78.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    source = MOCK_CITIES;
  }
  const cities = geographySchema.parse(source);
  if (new Set(cities.map(({ slug }) => slug)).size !== cities.length) {
    throw new Error("Le catalogue contient des slugs de communes en double.");
  }
  return cities.map((city) => ({
    ...city,
    context: {
      housingType: `Maison ou appartement à ${city.name} : précisez les pièces à rénover, la surface et votre budget pour préparer votre demande de devis.`,
      trafficNote: `Pour votre chantier à ${city.name}, prévoyez l’accès des artisans, les livraisons et l’évacuation des matériaux. Renseignez-vous auprès de la Ville avant d’occuper la voie publique.`,
      neighborhoods: MOCK_CITIES.find(({ slug }) => slug === city.slug)?.context.neighborhoods ?? [],
    },
    faq: [
      {
        question: `Quels travaux puis-je demander à ${city.name} ?`,
        answer: "Le formulaire couvre la rénovation globale, la salle de bain, la cuisine, la menuiserie et l’isolation. Indiquez la surface concernée et votre budget pour aider les professionnels à évaluer le projet.",
      },
      {
        question: `Comment préparer l’accès au chantier à ${city.name} ?`,
        answer: "Signalez les étages, les accès étroits et les possibilités de livraison à l’artisan. Pour une benne ou un véhicule occupant la voie publique, contactez les services municipaux afin de vérifier les démarches adaptées à votre adresse.",
      },
      {
        question: `Combien d’artisans recevront ma demande à ${city.name} ?`,
        answer: "Votre demande est transmise à deux professionnels maximum. Un artisan local vous contacte sous 24h pour préciser vos besoins et préparer un devis.",
      },
    ],
  }));
});
