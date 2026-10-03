import "server-only";
import { alertContent, type LeadAlert, type NotificationResult } from "./content";

export async function sendLeadTelegram(alert: LeadAlert): Promise<NotificationResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return "skipped";
  try {
    const content = alertContent(alert);
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(8000), cache: "no-store",
      body: JSON.stringify({ chat_id: chatId,
        text: `🟢 ${content.site.brandName} — Nouveau lead\n👤 ${alert.lead.customer.firstName} ${alert.lead.customer.lastName}\n📞 ${content.phone}\n📍 ${content.city} (${content.postalCode})\n📐 ${alert.lead.vertical === "renovation" ? `${alert.lead.projectType} · ${alert.lead.property.surface}` : alert.lead.projectDetails.surface} m²\n🕒 ${alert.createdAt}`,
        // Telegram refuse les boutons tel:. Le numéro reste détectable par ses clients.
        reply_markup: { inline_keyboard: [[{ text: "Consulter les leads", url: content.adminUrl }]] },
        link_preview_options: { is_disabled: true },
      }),
    });
    if (!response.ok || (await response.json()).ok !== true) throw new Error("Telegram rejected the notification");
    return "sent";
  } catch {
    console.error("Lead Telegram notification failed", { leadId: alert.id });
    return "failed";
  }
}
