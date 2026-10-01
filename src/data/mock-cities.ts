import { CitySchema, type City } from "../types/city";

/**
 * Contenus de démonstration : les accès sont à confirmer pour chaque adresse.
 * Sources municipales consultées le 29/09/2026 :
 * https://demarches.versailles.fr/
 * https://www.versailles.fr/?id=69
 * https://www.saintgermainenlaye.fr/1871/participation-citoyenne/conseils-de-quartiers.htm
 * https://www.saintgermainenlaye.fr/fileadmin/www.saintgermainenlaye.fr/MEDIA-SGL/RUBRIQUES/Votre_Mairie/Vos_demarches/Espace_public/Demenagement_demande_de_stationnement_particulier_2023.pdf
 * https://www.sartrouville.fr/mes-demarches/
 * https://www.sartrouville.fr/vivre-a-sartrouville/urbanisme/le-plan-local-durbanisme/
 * https://www.sartrouville.fr/wp-content/uploads/2022/08/magazine-20.pdf.pdf
 */
export const MOCK_CITIES: City[] = CitySchema.array()
  .refine((cities) => new Set(cities.map((city) => city.slug)).size === cities.length, {
    message: "Chaque commune doit avoir un slug unique.",
  })
  .parse([
    {
      slug: "versailles-78000",
      name: "Versailles",
      postalCode: "78000",
      departmentCode: "78",
      departmentName: "Yvelines",
      context: {
        housingType: "Appartements dans des immeubles anciens du centre historique, avec des maisons et résidences dans les secteurs plus résidentiels.",
        trafficNote: "Dans les quartiers Notre-Dame et Saint-Louis, repérez la largeur de la rue et la distance entre le camion et l’entrée. Consultez le portail municipal pour organiser le stationnement nécessaire au déménagement.",
        neighborhoods: ["Notre-Dame", "Saint-Louis", "Montreuil"],
      },
      faq: [
        {
          question: "Comment prévoir le stationnement d’un camion de déménagement à Versailles ?",
          answer: "Le portail de démarches de Versailles propose les démarches de stationnement et de déménagement. Précisez l’adresse, la date et l’emprise du camion, puis faites confirmer les conditions de réservation par la Ville avant de fixer l’organisation avec le déménageur.",
        },
        {
          question: "Que signaler pour un appartement ancien à Saint-Louis ou Notre-Dame ?",
          answer: "Indiquez l’étage, la présence ou l’absence d’ascenseur, les dimensions de la cage d’escalier et les éventuels passages par une cour. Si les meubles ne passent pas, faites étudier un monte-meubles et les autorisations nécessaires à son installation.",
        },
        {
          question: "Comment préparer l’accès à un logement à Montreuil ?",
          answer: "Vérifiez si le camion peut s’approcher du portail ou de l’entrée de l’immeuble. Transmettez au déménageur la distance de portage, les marches et les dimensions du passage ; une place disponible dans la rue ne garantit pas l’accès jusqu’au logement.",
        },
      ],
    },
    {
      slug: "saint-germain-en-laye-78100",
      name: "Saint-Germain-en-Laye",
      postalCode: "78100",
      departmentCode: "78",
      departmentName: "Yvelines",
      context: {
        housingType: "Habitat collectif, avec des appartements anciens en cœur de ville et des résidences ainsi que des maisons dans les quartiers périphériques.",
        trafficNote: "En cœur de ville, faites vérifier l’itinéraire du camion, les rues étroites et les éventuelles restrictions d’accès à l’adresse concernée. La Ville propose une demande de stationnement pour déménagement.",
        neighborhoods: ["Cœur de Ville - Forêt", "Lisière Pereire", "Rotondes - Saint-Léger"],
      },
      faq: [
        {
          question: "Comment demander une place pour déménager à Saint-Germain-en-Laye ?",
          answer: "Utilisez la démarche municipale de demande de stationnement pour déménagement. Faites confirmer par le service voirie les pièces, les modalités et les conditions en vigueur pour votre adresse ; la réservation et la signalisation doivent être organisées avant l’arrivée du camion.",
        },
        {
          question: "Un grand camion peut-il accéder à mon logement en cœur de ville ?",
          answer: "Cela dépend de la rue et de l’emplacement autorisé. Faites repérer la largeur de passage, les possibilités de manœuvre et les restrictions éventuelles. Le déménageur pourra prévoir un véhicule plus compact ou un portage adapté si l’accès est limité.",
        },
        {
          question: "Que vérifier dans une résidence de Lisière Pereire ou de Rotondes - Saint-Léger ?",
          answer: "Demandez au gestionnaire les conditions d’accès au bâtiment et d’utilisation de l’ascenseur. Mesurez sa cabine, signalez les étages à parcourir à pied et vérifiez la hauteur de tout passage couvert avant de prévoir l’entrée du véhicule.",
        },
      ],
    },
    {
      slug: "sartrouville-78500",
      name: "Sartrouville",
      postalCode: "78500",
      departmentCode: "78",
      departmentName: "Yvelines",
      context: {
        housingType: "Habitat mixte associant des secteurs pavillonnaires et des immeubles collectifs ; les conditions de manutention varient selon le quartier et la résidence.",
        trafficNote: "Repérez le stationnement et les possibilités de manœuvre, notamment près de la gare et dans les rues résidentielles. Pour occuper des places avec un camion, consultez la démarche municipale d’autorisation de stationnement pour déménagement.",
        neighborhoods: ["Vieux-Pays", "Les Dix-Arpents", "L’Union"],
      },
      faq: [
        {
          question: "Où demander une autorisation de stationnement pour déménager à Sartrouville ?",
          answer: "La rubrique « Mes démarches » du site de Sartrouville propose une autorisation de stationnement pour déménagement. Indiquez précisément le lieu et les besoins du camion, puis vérifiez auprès de la Ville les conditions applicables à l’emplacement souhaité.",
        },
        {
          question: "Que prévoir pour une maison aux Dix-Arpents ou dans le Vieux-Pays ?",
          answer: "Mesurez le portail et l’allée pour savoir si un véhicule peut entrer sur la parcelle. Précisez les marches, les étages et la distance entre la rue et la maison ; si le camion reste sur la voie publique, vérifiez les modalités de stationnement.",
        },
        {
          question: "Comment préparer un déménagement en immeuble dans le quartier de l’Union ?",
          answer: "Confirmez avec le gardien ou le syndic l’accès à la résidence, les dimensions de l’ascenseur s’il existe et les protections à prévoir dans les parties communes. Signalez toute absence d’ascenseur ainsi que les éventuelles marches entre le stationnement et le hall.",
        },
      ],
    },
  ] satisfies City[]);
