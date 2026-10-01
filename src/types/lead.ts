import { z } from "zod";

/** Contrat de validation d'un lead de déménagement. */
export const LeadDemenagementSchema = z.object({
  vertical: z.literal("demenagement").default("demenagement"),

  /** Codes postaux à cinq chiffres et villes de départ et d'arrivée. */
  geo: z.object({
    departurePostalCode: z.string().regex(/^[0-9]{5}$/),
    arrivalPostalCode: z.string().regex(/^[0-9]{5}$/),
    departureCity: z.string().trim().min(1),
    arrivalCity: z.string().trim().min(1),
  }),

  /** Surface en m², accès aux deux logements et date cible non vide. */
  projectDetails: z.object({
    housingType: z.enum(["appartement", "maison", "bureau"]),
    surface: z.number().min(9),
    departureFloor: z.number().min(0),
    arrivalFloor: z.number().min(0),
    departureElevator: z.boolean(),
    arrivalElevator: z.boolean(),
    targetDate: z.string().trim().min(1),
  }),

  /** Mobile sans séparateurs : 06/07 + huit chiffres ou +336/+337 + huit chiffres. */
  customer: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    phone: z.string().regex(/^(?:0|\+33)[67][0-9]{8}$/),
    email: z.email(),
  }),
});

/** Données validées, avec la valeur par défaut de vertical appliquée. */
export type LeadDemenagement = z.infer<typeof LeadDemenagementSchema>;
