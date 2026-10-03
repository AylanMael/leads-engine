import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../../lib/firebase-admin";
import { submitLead } from "../../../lib/lead-submission";
import { notifyNewLead } from "../../../lib/notifications";
import { localError, localResponse, withLocalStore } from "../../../lib/local-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== "development") return localResponse({ error: "Not found" }, 404);
  try {
    const partnerId = new URL(request.url).searchParams.get("partnerId");
    return localResponse(await withLocalStore(({ leads }) => leads
      .filter((lead) => !partnerId || lead.assignedPartners?.includes(partnerId))
      .sort((a, b) => (partnerId ? b.assignedAt ?? b.createdAt : b.createdAt).localeCompare(partnerId ? a.assignedAt ?? a.createdAt : a.createdAt))));
  } catch (error) { return localError(error); }
}

export async function POST(request: Request) {
  const project = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const useLocalStore = process.env.NODE_ENV === "development" && (!project || project === "lead-engine-local" || project.startsWith("REPLACE_WITH_"));
  return submitLead(request, {
    persist: async (lead) => {
      const id = randomUUID();
      if (useLocalStore) {
        const createdAt = new Date().toISOString();
        await withLocalStore(({ leads }) => { leads.push({ ...lead, id, createdAt, status: "pending" }); }, true);
        return { id, lead, createdAt };
      }
      const result = await getAdminDb().collection("leads").doc(id).create({ ...lead, status: "pending", createdAt: FieldValue.serverTimestamp() });
      return { id, lead, createdAt: result.writeTime.toDate().toISOString() };
    },
    // Les simulations locales n'envoient pas d'alertes à de vrais destinataires.
    defer: useLocalStore ? () => undefined : after,
    notify: notifyNewLead,
  });
}
