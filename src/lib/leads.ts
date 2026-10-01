import { FirebaseError } from "firebase/app";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { LeadDemenagementSchema, type LeadDemenagement } from "../types/lead";
import { getLeadFirestore } from "./firebase";
import { LeadRenovationSchema, type LeadRenovation } from "../types/lead-renovation";

const LeadSchema = LeadDemenagementSchema.or(LeadRenovationSchema);

/** Enregistre un lead validé dans Firebase ou via l’API locale si Firebase est absent. */
export async function saveLead(
  lead: LeadDemenagement | LeadRenovation,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const parsed = LeadSchema.safeParse(lead);
  if (!parsed.success) {
    return { success: false, error: "Certaines informations sont invalides. Vérifiez votre demande." };
  }

  try {
    const db = getLeadFirestore();
    if (!db) {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true || typeof result.id !== "string") {
        return { success: false, error: "Votre demande n’a pas pu être enregistrée localement. Veuillez réessayer." };
      }
      return { success: true, id: result.id };
    }

    // Firestore peut laisser une écriture hors ligne en attente indéfiniment.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return { success: false, error: "Vous semblez hors ligne. Vérifiez votre connexion puis réessayez." };
    }

    const document = await addDoc(collection(db, "leads"), {
      ...parsed.data,
      createdAt: serverTimestamp(),
      status: "pending",
    });
    return { success: true, id: document.id };
  } catch (error) {
    // Une erreur Firebase ne doit jamais être transformée en succès simulé.
    if (error instanceof FirebaseError && ["unavailable", "deadline-exceeded"].includes(error.code)) {
      return { success: false, error: "La connexion au service a échoué. Veuillez réessayer dans quelques instants." };
    }
    return { success: false, error: "Votre demande n’a pas pu être enregistrée. Veuillez réessayer plus tard." };
  }
}
