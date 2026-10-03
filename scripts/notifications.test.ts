import assert from "node:assert/strict";
import { test } from "node:test";
import { submitLead, SubmissionSchema } from "../src/lib/lead-submission";
import { alertContent, type LeadAlert } from "../src/lib/notifications/content";
import { sendLeadNotificationEmail as sendLeadEmail, buildLeadNotificationEmail, getLeadEmailFrom, getLeadResendKey } from "../src/lib/notifications/email";
import { sendLeadTelegram } from "../src/lib/notifications/telegram";
import { notifyNewLead } from "../src/lib/notifications";

const lead = SubmissionSchema.parse({ vertical: "renovation", geo: { departureCity: "Versailles", departurePostalCode: "78000", departureStreetAddress: "12 rue de Satory" }, customer: { firstName: "<Test>", lastName: "Exemple", phone: "0684275931", email: "test@example.com", salutation: "madame" }, projectType: "cuisine", property: { surface: 12, occupancyStatus: "proprietaire_occupant", buildingType: "maison" }, budgetBracket: "10k-30k" });
const alert: LeadAlert = { id: "test-lead", lead, createdAt: "2026-10-03T10:12:34.567Z" };
const request = (body: unknown = lead) => new Request("https://renovizo.fr/api/leads", { method: "POST", body: JSON.stringify(body) });

test("Enregistrement avant réponse ; notification lente ou en erreur indépendante", async () => {
  const tasks: (() => Promise<void>)[] = [];
  let saved = false; let notified = false;
  const response = await submitLead(request(), {
    persist: async () => { saved = true; return alert; },
    defer: (task) => { assert.equal(saved, true); tasks.push(task); },
    notify: async () => { notified = true; throw new Error("network failure"); },
  });
  assert.equal(response.status, 201); assert.equal(notified, false);
  assert.deepEqual(await response.json(), { success: true, id: alert.id });
  await tasks[0](); assert.equal(notified, true);
  const result = await submitLead(request(), { persist: async () => alert, defer: () => { throw new Error("scheduler failure"); }, notify: async () => {} });
  assert.equal(result.status, 201);
});

test("Aucune alerte après échec Firestore ou données invalides", async () => {
  let deferred = 0; let persisted = 0;
  const deps = { persist: async () => { persisted++; throw new Error("Firestore unavailable"); }, defer: () => { deferred++; }, notify: async () => {} };
  assert.equal((await submitLead(request(), deps)).status, 503);
  for (const invalid of [{ ...lead, status: "assigned" }, { ...lead, assignedPartners: ["forged"] }, { ...lead, geo: undefined }, { ...lead, customer: { ...lead.customer, firstName: "x".repeat(101) } }]) {
    assert.equal((await submitLead(request(invalid), deps)).status, 400);
  }
  assert.equal((await submitLead(request({ extra: "x".repeat(17000) }), deps)).status, 413);
  assert.equal(persisted, 1); assert.equal(deferred, 0);
});

test("Contenu des deux marques, surface réelle sans inventer de volume", () => {
  const content = alertContent(alert);
  assert.match(content.subject, /Rénovizo.*Versailles.*78000/);
  assert.match(content.text, /12 rue de Satory/);
  assert.equal(content.submittedAt, "03/10/2026 à 12:12");
  assert.match(buildLeadNotificationEmail(alert).html, /mailto:test@example.com/);
  assert.match(buildLeadNotificationEmail(alert).html, /Délai souhaité/);
  assert.match(content.text, /2026-10-03T10:12:34.567Z/);
  const moving = SubmissionSchema.parse({ vertical: "demenagement", geo: { ...lead.geo, arrivalCity: "Paris", arrivalPostalCode: "75015" }, customer: { firstName: "Test", lastName: "Exemple", phone: "0184275931", email: "test@example.com" }, projectDetails: { housingType: "maison", surface: 80, departureFloor: 0, arrivalFloor: 2, departureElevator: false, arrivalElevator: true, targetDate: "2026-12-01" } });
  const movingContent = alertContent({ ...alert, lead: moving });
  assert.match(movingContent.subject, /Déménizo/); assert.match(movingContent.text, /Paris, 75015/);
  assert.match(movingContent.text, /80 m²/); assert.match(movingContent.text, /Volume \(m³\) : Non renseigné/);
});

test("Prestataires simulés : HTML échappé, téléphone, erreurs et secrets absents", async () => {
  const keys = ["RESEND_API_KEY", "RESEND_API_KEY_RENOVATION", "RESEND_API_KEY_DEMENAGEMENT", "EMAIL_FROM_RENOVATION", "EMAIL_FROM_DEMENAGEMENT", "EMAIL_FROM", "ADMIN_NOTIFICATION_EMAIL", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"] as const;
  const previous = keys.map((key) => process.env[key]);
  const originalFetch = globalThis.fetch;
  try {
    keys.forEach((key) => delete process.env[key]);
    globalThis.fetch = async () => { throw new Error("No network call expected"); };
    assert.equal(await sendLeadEmail(alert), "skipped"); assert.equal(await sendLeadTelegram(alert), "skipped");
    Object.assign(process.env, { RESEND_API_KEY: "re_test", EMAIL_FROM: "test@example.com", ADMIN_NOTIFICATION_EMAIL: "admin@example.com", TELEGRAM_BOT_TOKEN: "test-token", TELEGRAM_CHAT_ID: "test-chat" });
    const calls: { url: string; body: Record<string, unknown>; headers: Headers }[] = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(String(options?.body)), headers: new Headers(options?.headers) });
      return Response.json({ id: "test-email", ok: true });
    };
    await notifyNewLead(alert); assert.equal(calls.length, 2);
    const email = calls.find((call) => call.url.includes("resend"))!;
    assert.match(String(email.body.html), /&lt;Test&gt;/); assert.doesNotMatch(String(email.body.html), /<Test>/);
    assert.match(String(email.body.html), /tel:\+33684275931/);
    assert.equal(email.headers.get("idempotency-key"), "lead-alert/test-lead");
    assert.equal(email.body.from, "test@example.com");
    delete process.env.EMAIL_FROM;
    assert.equal(await sendLeadEmail(alert), "sent");
    assert.equal(calls.at(-1)?.body.from, "Notification Lead <onboarding@resend.dev>");
    process.env.EMAIL_FROM_RENOVATION = "Rénovizo <notifications@renovizo.fr>";
    process.env.EMAIL_FROM_DEMENAGEMENT = "Déménizo <notifications@demenizo.fr>";
    assert.equal(getLeadEmailFrom("renovation"), "Rénovizo <notifications@renovizo.fr>");
    assert.equal(getLeadEmailFrom("demenagement"), "Déménizo <notifications@demenizo.fr>");
    assert.equal(await sendLeadEmail(alert), "sent");
    assert.equal(calls.at(-1)?.body.from, "Rénovizo <notifications@renovizo.fr>");
    process.env.RESEND_API_KEY_RENOVATION = "re_test_renovation";
    process.env.RESEND_API_KEY_DEMENAGEMENT = "re_test_demenagement";
    assert.equal(getLeadResendKey("renovation"), "re_test_renovation");
    assert.equal(getLeadResendKey("demenagement"), "re_test_demenagement");
    assert.equal(await sendLeadEmail(alert), "sent");
    assert.equal(calls.at(-1)?.headers.get("authorization"), "Bearer re_test_renovation");
    const telegram = calls.find((call) => call.url.includes("telegram"))!;
    assert.match(String(telegram.body.text), /\+33684275931/);
    globalThis.fetch = async () => Response.json({ ok: false, name: "validation_error", message: "rejected" }, { status: 400 });
    assert.equal(await sendLeadEmail(alert), "failed"); assert.equal(await sendLeadTelegram(alert), "failed");
    globalThis.fetch = async () => { throw new Error("network failure"); };
    await assert.doesNotReject(notifyNewLead(alert));
  } finally {
    globalThis.fetch = originalFetch;
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});
