import { getTenantConfig, type TenantConfig } from "../config/tenant";

export type ContractTemplateProps = {
  /** Raison sociale, SIRET et adresse légale de l'artisan partenaire. */
  companyName: string;
  siret: string;
  legalAddress: string;
  vertical: TenantConfig["vertical"];
  /** Prix unitaire en euros HT (et non en centimes). */
  creditPrice: number;
  /** Date civile du contrat, au format YYYY-MM-DD. */
  date: string;
};

/** Aperçu HTML imprimable. Ne recueille pas de signature électronique.
 * À rendre sur une page dédiée pour imprimer uniquement le contrat.
 */
export default function ContractTemplate({ companyName, siret, legalAddress, vertical, creditPrice, date }: ContractTemplateProps) {
  const normalizedSiret = siret.replace(/\s/g, "");
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (!companyName.trim() || !legalAddress.trim() || !/^\d{14}$/.test(normalizedSiret) ||
      !["demenagement", "renovation"].includes(vertical) ||
      !Number.isFinite(creditPrice) || creditPrice <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    throw new Error("Contrat : identité, SIRET, vertical, prix positif ou date YYYY-MM-DD invalide.");
  }
  const tenant = getTenantConfig(vertical);
  const activity = vertical === "demenagement" ? "déménagement" : "rénovation de l’habitat";
  const formattedPrice = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(creditPrice);
  const formattedDate = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" }).format(parsedDate);
  const incompleteProvider = tenant.legalEntity === "Raison sociale à renseigner";
  const sectionClass = "space-y-2 print:break-inside-avoid";
  const headingClass = "text-base font-bold text-slate-950 print:text-black";

  return (
    <article aria-label={`Contrat d’apport d’affaires — ${companyName}`} lang="fr"
      className="mx-auto max-w-[210mm] rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800 shadow-sm sm:p-10 print:max-w-none print:rounded-none print:border-0 print:p-0 print:text-[10pt] print:leading-normal print:text-black print:shadow-none">
      <header className="mb-7 border-b border-slate-200 pb-5 print:break-inside-avoid">
        <p className={`mb-2 text-sm font-semibold ${tenant.theme.accent} print:text-black`}>{tenant.brandName}</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 print:text-xl">Contrat d’apport d’affaires</h1>
        <p className="mt-2">Mise en relation professionnelle · {activity}</p>
        <p className="mt-1">Date : <time dateTime={date}>{formattedDate}</time></p>
        <p className="mt-3 text-xs text-slate-500 print:hidden">Aperçu HTML imprimable : utilisez la commande Imprimer du navigateur pour imprimer ou enregistrer en PDF.</p>
        {incompleteProvider && <p role="note" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 print:bg-white">
          Modèle à compléter avant signature : la raison sociale de l’apporteur d’affaires n’est pas encore renseignée dans la configuration de marque.
        </p>}
      </header>

      <section aria-label="Identification des parties" className="mb-7 grid gap-5 sm:grid-cols-2 print:grid-cols-2 print:break-inside-avoid">
        <div>
          <h2 className={headingClass}>La Plateforme</h2>
          <p className="mt-2 font-medium">{tenant.legalEntity}</p>
          <p>Exploitant la marque {tenant.brandName}</p>
          <p className="mt-2">SIRET : à compléter avant signature</p>
          <p>Adresse légale : à compléter avant signature</p>
        </div>
        <div>
          <h2 className={headingClass}>L’Artisan partenaire</h2>
          <p className="mt-2 break-words font-medium">{companyName}</p>
          <p>SIRET : {normalizedSiret}</p>
          <p className="whitespace-pre-line break-words">{legalAddress}</p>
        </div>
        <p className="sm:col-span-2 print:col-span-2">Département(s) d’intervention convenu(s), à compléter par les parties : <span className="inline-block min-w-40 border-b border-slate-400">&nbsp;</span></p>
      </section>

      <div className="space-y-6 print:space-y-4">
        <section className={sectionClass}>
          <h2 className={headingClass}>Article 1 — Objet</h2>
          <p>La Plateforme transmet à l’Artisan des demandes de devis qualifiées dans le domaine du {activity}, dans les départements convenus. Une demande, ci-après « lead », comporte les coordonnées du prospect et les informations collectées sur son projet. Elle est communiquée à deux professionnels au maximum.</p>
          <p>La qualification repose sur les informations déclarées par le prospect et leur contrôle de cohérence. La transmission ne garantit ni la conclusion d’un devis, ni un chiffre d’affaires, ni l’exclusivité du contact.</p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Article 2 — Indépendance et Responsabilité</h2>
          <p>La Plateforme agit comme strict intermédiaire numérique. Elle n’exécute pas la prestation de {activity}, ne fixe pas le prix du devis de l’Artisan et ne conclut pas le contrat de prestation pour son compte.</p>
          <p>L’Artisan exerce en toute indépendance. Il est seul responsable, à l’égard de son client, de ses devis, de l’exécution des travaux ou prestations, du respect des délais, des assurances et qualifications nécessaires, des garanties applicables et du service après-vente. Le contrat de prestation est conclu directement entre l’Artisan et le prospect.</p>
          <p>Cette répartition ne dispense pas la Plateforme de répondre de ses propres obligations et manquements dans le cadre du présent contrat.</p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Article 3 — Politique financière</h2>
          <p>Les mises en relation sont réglées par achat préalable de crédits. Le prix unitaire convenu est de <strong>{formattedPrice} HT par crédit</strong>, auquel s’ajoutent les taxes applicables indiquées lors de la commande. Un crédit est débité pour chaque lead attribué à l’Artisan.</p>
          <p>Les crédits sont valables douze mois à compter de leur achat. Les crédits non consommés à l’expiration de cette période deviennent inutilisables. Ils ne sont pas remboursables en numéraire, sous réserve des dispositions impératives applicables et des restitutions éventuellement dues en cas de manquement de la Plateforme. La contestation recevable d’un lead ouvre droit au recrédit prévu à l’article 4, et non à un remboursement du paiement en espèces ou par virement.</p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Article 4 — Politique de contestation (SLA)</h2>
          <p>L’Artisan doit signaler le problème depuis son espace partenaire, avec un commentaire explicatif, dans un délai strictement inférieur à quarante-huit heures à compter de l’attribution du lead. Les seuls motifs ouvrant droit au remplacement sont :</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>un faux numéro de téléphone ou un numéro ne correspondant pas au prospect ;</li>
            <li>un chantier ou projet situé hors du département ou des départements d’intervention convenus ; pour un déménagement, la localisation retenue est celle du départ ;</li>
            <li>un prospect non décideur, notamment un locataire ne disposant pas de l’accord du propriétaire.</li>
          </ul>
          <p>Le remplacement d’un lead recevablement contesté prend la forme du recrédit d’une unité permettant de recevoir une nouvelle demande, dans les quarante-huit heures suivant la réception de la contestation. Le traitement automatisé peut recréditer immédiatement le compte sur déclaration, sous contrôle de l’administrateur. Un même lead ne peut donner lieu qu’à un seul recrédit par Artisan.</p>
          <p>Le refus d’un devis en raison de son tarif, l’absence de conclusion d’un contrat ou le choix d’un autre professionnel n’ouvrent pas droit au remplacement. Une simple absence de réponse ne suffit pas à établir un faux numéro. Les contestations hors délai sont irrecevables au titre de cette politique commerciale, sans priver les parties de leurs droits légaux applicables.</p>
        </section>

        <section className={sectionClass}>
          <h2 className={headingClass}>Article 5 — Confidentialité et RGPD</h2>
          <p>L’Artisan s’engage à garder strictement confidentielles les données du prospect. Il lui est interdit de les revendre, de les céder, de les transmettre à d’autres professionnels ou de les utiliser à d’autres fins que la prise de contact nécessaire au chiffrage du devis expressément demandé. Il ne peut notamment les intégrer à une campagne publicitaire ou les utiliser pour proposer des prestations étrangères à cette demande.</p>
          <p>Chaque partie respecte les obligations du RGPD applicables aux traitements dont elle est responsable : information des personnes, base légale appropriée, limitation des accès, sécurité, minimisation et exercice des droits. L’Artisan limite la conservation des données à la durée nécessaire au traitement de la demande de devis ; toute conservation légalement requise ensuite fait l’objet d’un archivage restreint, sans réutilisation commerciale.</p>
          <p>Les accès sont réservés aux personnes habilitées à préparer le devis. L’Artisan informe sans délai la Plateforme de tout accès ou usage non autorisé dont il a connaissance et coopère à la protection des personnes concernées. La présente clause ne constitue pas, à elle seule, un consentement du prospect à la transmission ou à la réutilisation de ses données.</p>
        </section>
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-5 print:break-inside-avoid">
        <p>Établi le {formattedDate}. Les parties reconnaissent avoir pris connaissance des cinq articles et des informations d’identification et de périmètre complétées ci-dessus.</p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
          {["Pour la Plateforme", "Pour l’Artisan"].map((label) => <div key={label} className="min-h-32 rounded-lg border border-slate-300 p-4 print:rounded-none">
            <p className="font-semibold">{label}</p>
            <p className="mt-2 text-xs">Nom et qualité du signataire :</p>
            <p className="mt-4 text-xs">Date et signature :</p>
          </div>)}
        </div>
      </footer>
    </article>
  );
}
