import { ShieldCheck, Scale, LockKeyhole, MapPin } from "lucide-react";

const promises = [
  { icon: ShieldCheck, title: "Choisir en confiance", text: "SIRET actif et assurance à jour : les documents à vérifier avant de signer." },
  { icon: Scale, title: "Comparez librement", text: "Vous gardez le choix du professionnel. Aucune obligation de donner suite." },
  { icon: LockKeyhole, title: "Zéro démarchage inutile", text: "Vos coordonnées sont transmises à 2 professionnels concernés au maximum." },
  { icon: MapPin, title: "Ancrage local", text: "Une mise en relation selon votre commune et le secteur d’intervention." },
];

export default function TrustBadges() {
  return <section aria-label="Nos engagements" className="border-y border-slate-200 bg-white">
    <ul className="mx-auto grid max-w-7xl gap-8 px-4 py-9 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:gap-10">
      {promises.map(({ icon: Icon, title, text }) => <li key={title} className="flex items-start gap-3 lg:block">
        <span className="inline-flex shrink-0 rounded-xl bg-emerald-50 p-2.5 text-emerald-800"><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></span>
        <div><h2 className="font-semibold lg:mt-4">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>
      </li>)}
    </ul>
  </section>;
}
