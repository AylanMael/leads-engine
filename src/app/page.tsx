import { BadgeCheck, Clock3, LockKeyhole } from "lucide-react";
import LeadFormDemenagement from "../components/LeadFormDemenagement";

// La page reste un Server Component ; seul le formulaire est interactif.
export default function HomePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-16">
      <header className="mx-auto mb-8 max-w-3xl text-center sm:mb-10">
        <p className="mb-4 text-sm font-semibold tracking-wide text-teal-800">
          Votre déménagement, près de chez vous
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl sm:leading-tight">
          Gagnez du temps pour déménager.
          <span className="mt-2 block text-teal-800">Zéro spam commercial.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-700 sm:text-lg">
          Une seule demande, des artisans locaux assurés et 2 devis maximum
          pour choisir sereinement.
        </p>
      </header>

      <LeadFormDemenagement />

      <footer className="mx-auto mt-6 max-w-2xl sm:mt-8">
        <ul aria-label="Nos engagements" className="grid grid-cols-1 gap-4 text-sm text-slate-700 sm:grid-cols-3">
          <li className="flex items-center justify-center gap-2 sm:flex-col sm:text-center">
            <BadgeCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-teal-800" />
            <span>Artisans certifiés</span>
          </li>
          <li className="flex items-center justify-center gap-2 sm:flex-col sm:text-center">
            <Clock3 aria-hidden="true" className="h-5 w-5 shrink-0 text-teal-800" />
            <span>Réponse sous 24h</span>
          </li>
          <li className="flex items-center justify-center gap-2 sm:flex-col sm:text-center">
            <LockKeyhole aria-hidden="true" className="h-5 w-5 shrink-0 text-teal-800" />
            <span>Respect de vos données personnelles</span>
          </li>
        </ul>
      </footer>
    </main>
  );
}
