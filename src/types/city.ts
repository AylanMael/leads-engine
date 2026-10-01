import { z } from "zod";

/** Informations géographiques et éditoriales d'une page locale. */
export interface City {
  /** Identifiant stable, unique dans le catalogue des communes. */
  slug: string;
  name: string;
  postalCode: string;
  departmentCode: string;
  departmentName: string;
  context: {
    /** Description du bâti prédominant, et non du logement d'un prospect. */
    housingType: string;
    trafficNote: string;
    neighborhoods: string[];
  };
  faq: { question: string; answer: string }[];
}

const nonEmptyText = z.string().trim().min(1);

/** L'unicité d'un slug doit être contrôlée à l'échelle du catalogue. */
export const CitySchema: z.ZodType<City> = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: nonEmptyText,
  postalCode: z.string().regex(/^[0-9]{5}$/),
  // Métropole, Corse et départements d'outre-mer.
  departmentCode: z.string().regex(/^(?:0[1-9]|1[0-9]|2[1-9]|[3-8][0-9]|9[0-5]|2[AB]|97[12346])$/),
  departmentName: nonEmptyText,
  context: z.object({
    housingType: nonEmptyText,
    trafficNote: nonEmptyText,
    neighborhoods: z.array(nonEmptyText).min(2).max(3),
  }),
  faq: z.array(z.object({ question: nonEmptyText, answer: nonEmptyText })).min(1),
});
