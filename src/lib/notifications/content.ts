import type { LeadDemenagement } from "../../types/lead";
import type { LeadRenovation } from "../../types/lead-renovation";
import { getSiteConfig } from "../../config/site";

export type LeadAlert = {
  id: string;
  lead: LeadDemenagement | LeadRenovation;
  createdAt: string;
};
export type NotificationResult = "sent" | "skipped" | "failed";
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]!);

export function alertContent({ id, lead, createdAt }: LeadAlert) {
  const site = getSiteConfig(lead.vertical);
  const city = lead.geo?.departureCity ?? "Non renseignée";
  const postalCode = lead.geo?.departurePostalCode ?? "";
  const phone = lead.customer.phone.replace(/^0/, "+33");
  const parts = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Europe/Paris" }).formatToParts(new Date(createdAt));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const submittedAt = `${part("day")}/${part("month")}/${part("year")} à ${part("hour")}:${part("minute")}`;
  const rows: [string, string][] = [
    ["Marque", site.brandName],
    ["Contact", `${lead.customer.firstName} ${lead.customer.lastName}`],
    ["Téléphone", phone], ["E-mail", lead.customer.email],
    ["Adresse / commune", [lead.geo?.departureStreetAddress, city, postalCode].filter(Boolean).join(", ")],
  ];
  if (lead.vertical === "renovation") {
    const labels = { globale: "Rénovation globale", "salle-de-bain": "Salle de bain", cuisine: "Cuisine", menuiserie: "Menuiserie", isolation: "Isolation" };
    rows.push(["Travaux", labels[lead.projectType]], ["Surface", `${lead.property.surface} m²`], ["Bâti", lead.property.buildingType], ["Statut", lead.property.occupancyStatus], ["Budget", lead.budgetBracket], ["Délai souhaité", "Non renseigné"]);
  } else {
    const project = lead.projectDetails;
    rows.push(["Destination", [lead.geo.arrivalStreetAddress, lead.geo.arrivalCity, lead.geo.arrivalPostalCode].filter(Boolean).join(", ")],
      ["Logement", project.housingType], ["Surface", `${project.surface} m²`],
      ["Volume (m³)", "Non renseigné"],
      ["Étage départ / arrivée", `${project.departureFloor} / ${project.arrivalFloor}`],
      ["Ascenseur départ / arrivée", `${project.departureElevator ? "Oui" : "Non"} / ${project.arrivalElevator ? "Oui" : "Non"}`],
      ["Date souhaitée", project.targetDate]);
  }
  rows.push(["Reçue le (Europe/Paris)", submittedAt], ["Horodatage UTC", createdAt], ["Identifiant", id]);
  return { site, city, postalCode, phone, rows, submittedAt,
    adminUrl: `${site.domain}/admin`,
    subject: `[${site.brandName}] Nouveau lead : ${city} (${postalCode}) - ${phone}`.replace(/[\r\n]/g, " "),
    text: rows.map(([label, value]) => `${label} : ${value}`).join("\n"),
  };
}
