import { z } from "zod";
import { PhoneSchema } from "../lib/phone";

/** Contrat de validation d'un lead de déménagement. */
export const LeadDemenagementSchema = z.object({
  vertical: z.literal("demenagement").default("demenagement"),

  /** Codes postaux à cinq chiffres et villes de départ et d'arrivée. */
  geo: z.object({
    departureDepartment: z.string().regex(/^(?:|[0-9]{2}|2[AB]|97[1-6])$/).optional(),
    departureStreetAddress: z.string().trim().max(250).optional(),
    arrivalDepartment: z.string().regex(/^(?:|[0-9]{2}|2[AB]|97[1-6])$/).optional(),
    arrivalStreetAddress: z.string().trim().max(250).optional(),
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

  /** Téléphone français normalisé, sans suites artificielles évidentes. */
  customer: z.object({
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    phone: PhoneSchema,
    email: z.email(),
  }),
});

/** Données validées, avec la valeur par défaut de vertical appliquée. */
export type LeadDemenagement = z.infer<typeof LeadDemenagementSchema>;
