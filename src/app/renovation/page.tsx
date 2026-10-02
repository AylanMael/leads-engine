import PublicLanding from "../../components/PublicLanding";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artisans Rénov | Devis de rénovation locaux",
  description: "Préparez vos travaux avec des artisans locaux : jusqu’à 2 devis, sans spam commercial. Un professionnel vous contacte sous 24h.",
};

/** Cible interne de la racine du domaine rénovation. */
export default function RenovationPage() {
  return <PublicLanding vertical="renovation" />;
}
