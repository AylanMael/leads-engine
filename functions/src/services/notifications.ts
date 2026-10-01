import { createHash } from "node:crypto";

type Data = Record<string, unknown>;
export type AssignedPartner = { id: string; email?: unknown; phone?: unknown };

function object(value: unknown): Data {
  return value !== null && typeof value === "object" ? value as Data : {};
}
function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "Non renseigné";
}
function escapeHtml(value: unknown): string {
  return text(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
function phoneNumber(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[\s.()-]/g, "").replace(/^0([1-9][0-9]{8})$/, "+33$1");
  return /^\+[1-9][0-9]{7,14}$/.test(normalized) ? normalized : undefined;
}

// Aucun contenu personnel, secret ou corps de réponse prestataire dans les logs.
async function sendEmail(to: unknown, subject: string, html: string, key: string): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from || typeof to !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      console.warn("Notification e-mail ignorée : configuration ou destinataire manquant/invalide.");
      return;
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": key },
      body: JSON.stringify({ from, to: [to], subject, html }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) console.error("Échec Resend", { status: response.status, key });
  } catch {
    console.error("Échec réseau ou délai dépassé Resend", { key });
  }
}

async function sendSms(to: unknown, body: string): Promise<void> {
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    const phone = phoneNumber(to);
    if (!sid || !token || !from || !phone) {
      console.warn("Notification SMS ignorée : configuration ou destinataire manquant/invalide.");
      return;
    }
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: from, To: phone, Body: body }),
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) console.error("Échec Twilio", { status: response.status });
  } catch {
    console.error("Échec réseau ou délai dépassé Twilio");
  }
}

/** Envois parallèles après commit uniquement. Une acceptation API ne garantit pas la livraison. */
export async function notifyLeadAssignment(leadId: string, lead: Data, partners: AssignedPartner[]): Promise<void> {
  try {
    if (partners.length === 0) return;
    const renovation = lead.vertical === "renovation";
    const brand = renovation
      ? process.env.RENOVATION_BRAND_NAME || "Artisans Rénov"
      : process.env.DEMENAGEMENT_BRAND_NAME || "Déménageurs de France";
    const vertical = renovation ? "rénovation" : "déménagement";
    const geo = object(lead.geo);
    const customer = object(lead.customer);
    const project = object(renovation ? lead.property : lead.projectDetails);
    const rows: [string, unknown][] = [
      ["Projet", vertical], ["Ville", geo.departureCity], ["Code postal", geo.departurePostalCode],
      ["Surface (m²)", project.surface],
    ];
    if (renovation) {
      rows.push(["Travaux", lead.projectType], ["Bâti", project.buildingType], ["Statut d’occupation", project.occupancyStatus], ["Budget", lead.budgetBracket]);
    } else {
      rows.push(["Arrivée", geo.arrivalCity], ["Code postal d’arrivée", geo.arrivalPostalCode],
        ["Logement", project.housingType], ["Étage de départ", project.departureFloor], ["Étage d’arrivée", project.arrivalFloor],
        ["Ascenseur au départ", typeof project.departureElevator === "boolean" ? project.departureElevator ? "Oui" : "Non" : undefined],
        ["Ascenseur à l’arrivée", typeof project.arrivalElevator === "boolean" ? project.arrivalElevator ? "Oui" : "Non" : undefined],
        ["Date souhaitée", project.targetDate]);
    }
    const recap = `<table>${rows.map(([label, value]) => `<tr><th align="left" style="padding:8px">${escapeHtml(label)}</th><td style="padding:8px">${escapeHtml(value)}</td></tr>`).join("")}</table>`;
    const phone = phoneNumber(customer.phone);
    const contact = `<p>Prospect : ${escapeHtml(customer.firstName)} ${escapeHtml(customer.lastName)}</p><p>Téléphone : ${phone ? `<a href="tel:${phone}">${escapeHtml(customer.phone)}</a>` : escapeHtml(customer.phone)}</p><p>E-mail : ${escapeHtml(customer.email)}</p>`;
    const wrap = (body: string) => `<!doctype html><html lang="fr"><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif;color:#0f172a"><h1>${escapeHtml(brand)}</h1>${body}</body></html>`;
    const key = (recipient: string) => createHash("sha256").update(JSON.stringify([leadId, recipient])).digest("hex");
    const jobs = partners.flatMap((partner) => [
      sendSms(partner.phone, `${brand} : Nouveau projet ${vertical} à ${text(geo.departureCity)} (${text(geo.departurePostalCode)}). Détails du chantier envoyés par e-mail. À vous de jouer !`),
      sendEmail(partner.email, `${brand} : nouveau projet de ${vertical}`, wrap(`<h2>Un nouveau projet vous est attribué</h2>${recap}${contact}<p>Contactez le prospect dès que possible.</p>`), key(`partner:${partner.id}`)),
    ]);
    const promise = partners.length === 1
      ? "1 professionnel vérifié va vous contacter sous 24h."
      : "2 professionnels vérifiés vont vous contacter sous 24h.";
    jobs.push(sendEmail(customer.email, `${brand} : votre demande est confirmée`, wrap(`<h2>Merci pour votre demande</h2><p>Bonjour ${escapeHtml(customer.firstName)},</p><p>${promise}</p>${recap}<p>Vous pourrez échanger sur votre projet et préciser vos besoins.</p>`), key("customer")));
    await Promise.allSettled(jobs);
  } catch {
    console.error("Impossible de préparer les notifications", { leadId });
  }
}
