/** Cas techniques à examiner, et sources officielles ; aucune règle générale inventée. */
export const DEPARTMENT_CONTEXT = {
  "75": {
    scenarios: "Selon le logement : copropriété haussmannienne, cour pavée, porche, escalier étroit ou ascenseur de petite capacité. Ne pas affirmer que tous les immeubles ou arrondissements ont ces caractéristiques. Traiter des contraintes différentes selon la zone.",
    moving: "Pour un camion ou monte-meubles sur l’espace public, vérifier l’AOT déménagement de la Ville de Paris via Mon Paris. Elle est notamment nécessaire pour un monte-meubles, pour dépasser six heures au même emplacement ou pour stationner hors bande payante. Une AOT ne garantit pas qu’une place soit libre. Ne pas envoyer systématiquement le lecteur vers la préfecture de police : suivre le service de la Ville et les instructions éventuelles pour le cas particulier.",
    renovation: "Distinguer une AOT déménagement de l’occupation liée aux travaux : vérifier le service CITE de la Ville de Paris pour le stationnement de chantier. Vérifier les règles de bruit applicables à l’intervention et le règlement de copropriété ; ne pas inventer des horaires ni confondre bricolage particulier et chantier professionnel. Vérifier PLU, protection patrimoniale et autorisations selon la parcelle et la nature des travaux.",
    sources: ["https://www.paris.fr/pages/faq-demenagements-4404/", "https://www.paris.fr/pages/demande-d-emprise-sur-l-espace-public-cite-30288", "https://www.paris.fr/pages/nuisances-sonores-qui-faut-il-alerter-8198"],
  },
  "92": {
    scenarios: "Cas possibles à traiter de façon conditionnelle : rue dense, résidence de standing avec gardien, maison en secteur pavillonnaire ou immeuble de bureaux. Ne pas présenter ces cas comme des caractéristiques documentées de chaque commune. Gardien : modalités d’accès et protection des parties communes ; bureaux : créneaux de livraison, ascenseurs de service et coactivité ; pavillon : largeur du portail et distance de portage.",
    moving: "Contacter la mairie ou le gestionnaire de voirie compétent pour les modalités d’occupation et de stationnement à l’adresse exacte ; ne pas extrapoler les procédures parisiennes aux Hauts-de-Seine.",
    renovation: "Vérifier le PLU applicable, les éventuelles autorisations patrimoniales et les accords de copropriété selon le projet. Prévoir bruit, livraison, stockage et évacuation des matériaux sans inventer d’horaires départementaux uniformes.",
    sources: ["https://www.service-public.gouv.fr/particuliers/vosdroits/F31117"],
  },
};

/** Garde-fous éditoriaux : les horaires non sourcés ne doivent pas être publiés. */
export function validateDepartmentContent(content, city, vertical) {
  if (!["75", "92"].includes(city.departmentCode)) return;
  const paragraphs = [content.accessNotice, ...content.faq.map(({ answer }) => answer)];
  for (const text of paragraphs) {
    if (/\b\d{1,2}\s*(?:h\b|h\d|heures?\b|:\d{2})/i.test(text) && vertical === "renovation") {
      throw new Error("Horaires chiffrés non sourcés : renvoyer vers les règles applicables à l’intervention, sans inventer de plage horaire");
    }
    if (city.departmentCode === "75" && /CITE/.test(text) && /bruit|sonore|horaires? (?:autorisés|de travaux)/i.test(text)) {
      throw new Error("CITE concerne l’emprise du chantier, pas la consultation des règles de bruit : séparer ces démarches");
    }
    if (city.departmentCode === "75" && /sans autorisation de stationnement/i.test(text) && !/six heures|6 heures|bande payante|monte.meubles/i.test(text)) {
      throw new Error("L’AOT parisienne n’est pas obligatoire dans tous les cas : distinguer stationnement payant ordinaire et cas exigeant une AOT");
    }
  }
}
