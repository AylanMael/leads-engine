import { z } from "zod";

/** Contrat d'un projet de rénovation éligible à une mise en relation. */
export const LeadRenovationSchema = z.object({
  vertical: z.literal("renovation"),
  /** Facultatif pour les anciens leads ; renseigné par le formulaire de demande. */
  geo: z.object({
    departureCity: z.string().trim().min(1, "Indiquez la commune du chantier."),
    departurePostalCode: z.string().regex(/^[0-9]{5}$/, "Indiquez un code postal à 5 chiffres."),
  }).optional(),
  projectType: z.enum(["globale", "salle-de-bain", "cuisine", "menuiserie", "isolation"], {
    error: "Sélectionnez le type de travaux.",
  }),
  property: z.object({
    occupancyStatus: z.enum(["proprietaire_occupant", "proprietaire_bailleur", "futur_acquereur"], {
      error: "Sélectionnez un statut éligible. L’accord du propriétaire est requis pour les locataires.",
    }),
    // Les petites surfaces sont acceptées, notamment pour une salle de bain.
    surface: z.number({ error: "Indiquez la surface concernée." }).positive("La surface doit être supérieure à 0 m²."),
    buildingType: z.enum(["maison", "appartement"], { error: "Sélectionnez le type de bâti." }),
  }),
  budgetBracket: z.enum(["< 10k", "10k-30k", "30k-60k", "> 60k"], { error: "Sélectionnez une fourchette de budget." }),
  customer: z.object({
    salutation: z.enum(["madame", "monsieur"], { error: "Sélectionnez votre civilité." }),
    lastName: z.string().trim().min(1, "Indiquez votre nom."),
    firstName: z.string().trim().min(1, "Indiquez votre prénom."),
    phone: z.string().regex(/^(?:0|\+33)[67][0-9]{8}$/, "Saisissez un mobile en 06 ou 07, sans espaces (10 chiffres ou format +33)."),
    email: z.email("Saisissez une adresse e-mail valide."),
  }),
});

export type LeadRenovation = z.infer<typeof LeadRenovationSchema>;
