import "server-only";
import { sendLeadNotificationEmail } from "./email";
import { sendLeadTelegram } from "./telegram";
import type { LeadAlert } from "./content";

/** Les canaux sont indépendants ; aucune erreur ne remonte vers le prospect. */
export async function notifyNewLead(alert: LeadAlert): Promise<void> {
  await Promise.allSettled([sendLeadNotificationEmail(alert), sendLeadTelegram(alert)]);
}
