import { getApp, getApps, initializeApp } from "firebase-admin/app";
import { FieldPath, FieldValue, Timestamp, getFirestore, type Firestore, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onSchedule } from "firebase-functions/v2/scheduler";

/** Treize mois calendaires UTC, avec plafonnement au dernier jour du mois cible. */
export function retentionCutoff(reference: Date): Date {
  if (!Number.isFinite(reference.getTime())) throw new Error("Date de référence invalide");
  const cutoff = new Date(reference);
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 13);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff;
}

export function customerIsMasked(customer: unknown): boolean {
  if (!customer || typeof customer !== "object") return false;
  const fields = customer as Record<string, unknown>;
  return ["firstName", "lastName", "phone", "email"].every((field) => fields[field] === "***");
}

/** Pagination stable ; transaction par page et compteur après commit uniquement. */
export async function anonymizeExpiredLeads(db: Firestore, reference: Date) {
  const cutoff = Timestamp.fromDate(retentionCutoff(reference));
  const pageSize = 200;
  let cursor: QueryDocumentSnapshot | undefined;
  let scanned = 0;
  let anonymized = 0;
  try {
    while (true) {
      let query = db.collection("leads").where("createdAt", "<", cutoff)
        .orderBy("createdAt").orderBy(FieldPath.documentId()).limit(pageSize);
      if (cursor) query = query.startAfter(cursor);
      const page = await db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(query);
        let changed = 0;
        for (const document of snapshot.docs) {
          if (customerIsMasked(document.data().customer)) continue;
          transaction.update(document.ref, {
            "customer.firstName": "***",
            "customer.lastName": "***",
            "customer.phone": "***",
            "customer.email": "***",
            anonymizedAt: FieldValue.serverTimestamp(),
          });
          changed++;
        }
        return { size: snapshot.size, changed, last: snapshot.docs.at(-1) };
      });
      scanned += page.size;
      anonymized += page.changed;
      cursor = page.last;
      if (page.size < pageSize) break;
    }
    const result = { scanned, anonymized, cutoff: cutoff.toDate().toISOString() };
    logger.info("Expurgation mensuelle des leads terminée", result);
    return result;
  } catch (error) {
    // Aucun nom, téléphone, e-mail ou contenu de document dans les journaux.
    logger.error("Expurgation interrompue ; les pages déjà validées restent traitées", {
      scanned, anonymized, cutoff: cutoff.toDate().toISOString(),
    });
    throw error; // Le planificateur doit constater l'échec et pouvoir réessayer.
  }
}

export const rgpdAnonymization = onSchedule({
  schedule: "every 1 of month 02:00",
  timeZone: "Europe/Paris",
  maxInstances: 1,
  concurrency: 1,
  timeoutSeconds: 540,
  retryCount: 3,
}, async (event) => {
  const app = getApps().some((item) => item.name === "[DEFAULT]") ? getApp() : initializeApp();
  // Un événement rejoué garde le même seuil, calculé depuis sa date planifiée.
  await anonymizeExpiredLeads(getFirestore(app), new Date(event.scheduleTime));
});
