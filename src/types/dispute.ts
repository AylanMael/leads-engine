import { z } from "zod";

export const DISPUTE_REASONS = {
  fake_phone: "Faux numéro de téléphone",
  outside_zone: "Projet hors de ma zone",
  tenant_no_permission: "Locataire sans accord du propriétaire",
} as const;

export const DisputeSchema = z.object({
  leadId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
  reason: z.enum(["fake_phone", "outside_zone", "tenant_no_permission"]),
  comment: z.string().trim().min(1, "Expliquez le problème rencontré.").max(2000),
}).strict();

export type DisputeInput = z.infer<typeof DisputeSchema>;
export const DISPUTE_WINDOW_MS = 48 * 60 * 60 * 1000;
