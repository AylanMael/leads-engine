import "server-only";
import { LeadDemenagementSchema } from "../types/lead";
import { LeadRenovationSchema } from "../types/lead-renovation";
import type { LeadAlert } from "./notifications/content";

// Admin SDK contourne les règles Firestore : conserver leurs limites de saisie.
const customer = LeadDemenagementSchema.shape.customer.extend({
  firstName: LeadDemenagementSchema.shape.customer.shape.firstName.max(100),
  lastName: LeadDemenagementSchema.shape.customer.shape.lastName.max(100),
  email: LeadDemenagementSchema.shape.customer.shape.email.max(254),
}).strict();
const moving = LeadDemenagementSchema.extend({
  customer,
  geo: LeadDemenagementSchema.shape.geo.extend({
    departureCity: LeadDemenagementSchema.shape.geo.shape.departureCity.max(150),
    arrivalCity: LeadDemenagementSchema.shape.geo.shape.arrivalCity.max(150),
  }).strict(),
  projectDetails: LeadDemenagementSchema.shape.projectDetails.extend({
    surface: LeadDemenagementSchema.shape.projectDetails.shape.surface.max(1000000),
    departureFloor: LeadDemenagementSchema.shape.projectDetails.shape.departureFloor.max(1000),
    arrivalFloor: LeadDemenagementSchema.shape.projectDetails.shape.arrivalFloor.max(1000),
    targetDate: LeadDemenagementSchema.shape.projectDetails.shape.targetDate.max(100),
  }).strict(),
}).strict();
const renovation = LeadRenovationSchema.extend({
  customer: customer.extend({ salutation: LeadRenovationSchema.shape.customer.shape.salutation }).strict(),
  geo: LeadRenovationSchema.shape.geo.unwrap().extend({
    departureCity: LeadRenovationSchema.shape.geo.unwrap().shape.departureCity.max(150),
  }).strict(),
  property: LeadRenovationSchema.shape.property.extend({ surface: LeadRenovationSchema.shape.property.shape.surface.max(1000000) }).strict(),
}).strict();
export const SubmissionSchema = moving.or(renovation);
type Dependencies = {
  persist: (lead: LeadAlert["lead"]) => Promise<LeadAlert>;
  defer: (task: () => Promise<void>) => void;
  notify: (alert: LeadAlert) => Promise<void>;
};
const respond = (data: unknown, status: number) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Dépendances explicites pour tester écriture → réponse → notification. */
export async function submitLead(request: Request, dependencies: Dependencies): Promise<Response> {
  let payload: unknown;
  try {
    const body = await request.text();
    if (Buffer.byteLength(body, "utf8") > 16384) return respond({ error: "Demande trop volumineuse." }, 413);
    payload = JSON.parse(body);
  } catch { return respond({ error: "JSON invalide." }, 400); }
  const parsed = SubmissionSchema.safeParse(payload);
  if (!parsed.success) return respond({ error: "Les informations du lead sont invalides." }, 400);
  let alert: LeadAlert;
  try { alert = await dependencies.persist(parsed.data); }
  catch {
    console.error("Lead persistence failed");
    return respond({ error: "Votre demande n’a pas pu être enregistrée. Veuillez réessayer." }, 503);
  }
  try {
    dependencies.defer(async () => {
      try { await dependencies.notify(alert); }
      catch { console.error("Lead notifications failed", { leadId: alert.id }); }
    });
  } catch {
    // Une écriture réussie reste un succès même si la planification échoue.
    console.error("Lead notifications scheduling failed", { leadId: alert.id });
  }
  return respond({ success: true, id: alert.id }, 201);
}
