import "server-only";
import { Resend } from "resend";
import { alertContent, escapeHtml, type LeadAlert, type NotificationResult } from "./content";

/** Lead enregistré, avec identifiant et horodatage serveur. */
export type Lead = LeadAlert;

export function getLeadResendKey(vertical: Lead["lead"]["vertical"]): string | undefined {
  const branded = vertical === "renovation"
    ? process.env.RESEND_API_KEY_RENOVATION
    : process.env.RESEND_API_KEY_DEMENAGEMENT;
  return branded?.trim() || process.env.RESEND_API_KEY?.trim() || undefined;
}

export function getLeadEmailFrom(vertical: Lead["lead"]["vertical"]): string {
  const branded = vertical === "renovation" ? process.env.EMAIL_FROM_RENOVATION : process.env.EMAIL_FROM_DEMENAGEMENT;
  return branded?.trim() || process.env.EMAIL_FROM?.trim() || "Notification Lead <onboarding@resend.dev>";
}

export function buildLeadNotificationEmail(leadData: Lead) {
  const content = alertContent(leadData);
  const { lead } = leadData;
  const accent = lead.vertical === "renovation" ? "#047857" : "#1e40af";
  const vertical = lead.vertical === "renovation" ? "Rénovation" : "Déménagement";
  const row = (label: string, value: string, href?: string) => `<tr><td style="padding:10px 0;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere"><span style="font-size:12px;color:#64748b">${escapeHtml(label)}</span><br>${href ? `<a style="color:${accent};font-weight:600" href="${escapeHtml(href)}">${escapeHtml(value)}</a>` : escapeHtml(value)}</td></tr>`;
  const section = (title: string, rows: string) => `<h2 style="font-size:18px;margin:24px 0 8px">${title}</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="table-layout:fixed;border-collapse:collapse">${rows}</table>`;
  const projectRows = content.rows.slice(5, -3).map(([label, value]) => row(label, value)).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f5f9;color:#0f172a;font:16px Arial,sans-serif;line-height:1.5"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:16px 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px"><tr><td style="padding:24px;background:${accent};color:white;border-radius:16px 16px 0 0"><span style="font-size:12px;letter-spacing:1px">ALERTE ADMINISTRATEUR</span><h1 style="font-size:26px;margin:8px 0">${escapeHtml(content.site.brandName)}</h1><span style="display:inline-block;padding:4px 12px;border:1px solid #ffffff80;border-radius:20px;font-size:13px">${vertical}</span></td></tr><tr><td style="padding:24px"><p style="margin:0;font-size:20px;font-weight:bold">Un nouveau projet à ${escapeHtml(content.city)}</p><p style="margin:8px 0;color:#64748b">Reçu le ${escapeHtml(content.submittedAt)} (heure de Paris)</p>${section("Contact", row("Prénom", lead.customer.firstName) + row("Nom", lead.customer.lastName) + row("E-mail", lead.customer.email, `mailto:${lead.customer.email}`) + row("Téléphone", content.phone, `tel:${content.phone}`))}${section("Localisation", row("Adresse", lead.geo?.departureStreetAddress || "Non renseignée") + row("Ville", content.city) + row("Code postal", content.postalCode))}${section("Détails du projet", projectRows)}<p style="margin:28px 0 12px"><a href="tel:${escapeHtml(content.phone)}" style="display:block;padding:14px;text-align:center;background:${accent};color:white;text-decoration:none;border-radius:8px;font-weight:bold">Appeler le prospect</a></p><p style="text-align:center"><a style="color:${accent}" href="${escapeHtml(content.adminUrl)}">Consulter les demandes dans l’administration</a></p><p style="font-size:12px;color:#64748b;margin-top:24px">Référence : ${escapeHtml(leadData.id)}<br>Notification interne · Coordonnées réservées au traitement de cette demande.</p></td></tr></table></td></tr></table></body></html>`;
  return { subject: content.subject, html, text: content.text };
}

export async function sendLeadNotificationEmail(leadData: Lead): Promise<NotificationResult> {
  const key = getLeadResendKey(leadData.lead.vertical);
  const to = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  const from = getLeadEmailFrom(leadData.lead.vertical);
  if (!key || !to) return "skipped";
  try {
    const message = buildLeadNotificationEmail(leadData);
    const response = await new Resend(key).emails.send({ from, to, ...message }, {
      idempotencyKey: `lead-alert/${leadData.id}`, signal: AbortSignal.timeout(8000),
    });
    if (response.error || !response.data?.id) {
      console.error("Erreur Resend:", { leadId: leadData.id, code: response.error?.name ?? "missing_email_id" });
      return "failed";
    }
    return "sent";
  } catch {
    // Éviter les réponses brutes susceptibles de contenir les coordonnées ou la clé.
    console.error("Erreur Resend:", { leadId: leadData.id, code: "notification_failed" });
    return "failed";
  }
}

/** Alias conservé pour les intégrations existantes. */
export const sendLeadEmail = sendLeadNotificationEmail;
