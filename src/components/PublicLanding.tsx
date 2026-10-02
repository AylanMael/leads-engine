import type { LocalContentCity } from "../data/local-cities";
import { getTenantConfig, type TenantConfig } from "../config/tenant";
import { TenantProvider } from "./TenantProvider";
import Header from "./Header";
import Footer from "./Footer";
import LocalHero from "./LocalHero";
import TrustBadges from "./TrustBadges";
import LocalContent from "./LocalContent";
import LeadFormDemenagement from "./LeadFormDemenagement";
import LeadFormRenovation from "./LeadFormRenovation";
import CityJsonLd from "./CityJsonLd";

/** Composition serveur commune : seul le formulaire ajoute de l'interactivité JS. */
export default function PublicLanding({ vertical, city }: { vertical: TenantConfig["vertical"]; city?: LocalContentCity }) {
  return <TenantProvider tenant={getTenantConfig(vertical)}>
    <Header vertical={vertical} />
    <main id="contenu">
      {city && <CityJsonLd city={city} vertical={vertical} />}
      <LocalHero city={city} vertical={vertical}>{vertical === "renovation" ? <LeadFormRenovation defaultCity={city?.name} defaultPostalCode={city?.postalCode} /> : <LeadFormDemenagement defaultCity={city?.name} defaultPostalCode={city?.postalCode} />}</LocalHero>
      <TrustBadges />
      {city ? <LocalContent city={city} vertical={vertical} /> : <section className="mx-auto max-w-7xl px-4 py-14 sm:px-8 sm:py-20"><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Simple, du début à la fin</p><h2 className="mt-4 text-3xl font-semibold tracking-tight">Un projet. Trois étapes. Le choix vous appartient.</h2><ol className="mt-10 grid gap-8 sm:grid-cols-3">{[["01", "Décrivez votre projet", "Votre commune, vos besoins et vos contraintes : quelques informations pour préparer un échange utile."], ["02", "Échangez en direct", "Jusqu’à 2 professionnels de votre secteur peuvent vous contacter pour préciser votre demande."], ["03", "Choisissez sereinement", "Comparez les prestations, les assurances et les devis. Vous décidez librement de la suite."]].map(([number, title, text]) => <li key={number} className="border-t border-slate-200 pt-5"><span className="text-sm font-semibold text-emerald-800">{number}</span><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-7 text-slate-600">{text}</p></li>)}</ol></section>}
    </main>
    <Footer vertical={vertical} />
  </TenantProvider>;
}
