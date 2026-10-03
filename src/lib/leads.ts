import { LeadDemenagementSchema, type LeadDemenagement } from "../types/lead";
import { LeadRenovationSchema, type LeadRenovation } from "../types/lead-renovation";

const LeadSchema = LeadDemenagementSchema.or(LeadRenovationSchema);

/** Le serveur enregistre puis programme les notifications, sans exposer ses secrets. */
export async function saveLead(lead: LeadDemenagement | LeadRenovation): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = LeadSchema.safeParse(lead);
  if (!parsed.success || (parsed.data.vertical === "renovation" && !parsed.data.geo)) {
    return { success: false, error: "Certaines informations sont invalides. Vérifiez votre demande." };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { success: false, error: "Vous semblez hors ligne. Vérifiez votre connexion puis réessayez." };
  }
  try {
    const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
    const result = await response.json();
    if (!response.ok || result.success !== true || typeof result.id !== "string") throw new Error("Submission failed");
    return { success: true, id: result.id };
  } catch {
    return { success: false, error: "Votre demande n’a pas pu être enregistrée. Veuillez réessayer plus tard." };
  }
}
