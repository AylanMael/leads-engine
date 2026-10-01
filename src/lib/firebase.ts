import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";

// Accès explicites nécessaires à l'injection des variables publiques par Next.js.
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
};

/** Les placeholders locaux ne doivent pas activer une connexion Firebase réelle. */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.apiKey !== "mock-api-key" &&
  !firebaseConfig.apiKey.startsWith("REPLACE_WITH_") &&
  firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("REPLACE_WITH_") &&
  firebaseConfig.appId && !firebaseConfig.appId.startsWith("REPLACE_WITH_"),
);

/** Initialisation différée et idempotente, y compris après un rechargement en dev. */
function getClientApp() {
  if (!isFirebaseConfigured) return null;

  const app = getApps().some((app) => app.name === "[DEFAULT]")
    ? getApp()
    : initializeApp(firebaseConfig);

  return app;
}

export function getLeadFirestore(): Firestore | null {
  const app = getClientApp();
  return app ? getFirestore(app) : null;
}

export function getPartnerAuth(): Auth | null {
  const app = getClientApp();
  return app ? getAuth(app) : null;
}
