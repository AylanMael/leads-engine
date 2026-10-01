/** Identité, styles et textes partagés par les composants d'une marque. */
export type TenantConfig = {
  readonly vertical: "demenagement" | "renovation";
  readonly brandName: string;
  readonly legalEntity: string;
  readonly theme: {
    readonly accent: string;
    readonly button: string;
    readonly badge: string;
  };
  readonly labels: {
    readonly mainTitle: string;
    readonly tagline: string;
    readonly matchingPromise: string;
  };
};

// Classes complètes et statiques pour permettre leur détection par Tailwind.
const TENANTS = {
  demenagement: {
    vertical: "demenagement",
    brandName: "Déménageurs de France",
    // À remplacer par la raison sociale réelle de l'apporteur d'affaires.
    legalEntity: "Raison sociale à renseigner",
    theme: {
      accent: "text-teal-800",
      button: "bg-teal-700 text-white hover:bg-teal-800 focus-visible:ring-teal-700",
      badge: "border-teal-200 bg-teal-50 text-teal-800",
    },
    labels: {
      mainTitle: "Gagnez du temps pour déménager.",
      tagline: "Une seule demande, jusqu’à 2 devis locaux, sans spam commercial.",
      matchingPromise: "Un artisan local vous contacte sous 24h pour préparer votre déménagement.",
    },
  },
  renovation: {
    vertical: "renovation",
    brandName: "Artisans Rénov",
    // À remplacer par la raison sociale réelle de l'apporteur d'affaires.
    legalEntity: "Raison sociale à renseigner",
    theme: {
      accent: "text-indigo-800",
      button: "bg-indigo-700 text-white hover:bg-indigo-800 focus-visible:ring-indigo-700",
      badge: "border-indigo-200 bg-indigo-50 text-indigo-800",
    },
    labels: {
      mainTitle: "Donnez vie à vos projets de rénovation.",
      tagline: "Une seule demande, jusqu’à 2 devis locaux, sans spam commercial.",
      matchingPromise: "Un artisan local vous contacte sous 24h pour échanger sur vos travaux.",
    },
  },
} as const satisfies Record<TenantConfig["vertical"], TenantConfig>;

/** Résolution pure partagée ; passer la marque de la requête en multi-domaines. */
export function getTenantConfig(vertical: string | null | undefined = process.env.NEXT_PUBLIC_VERTICAL): TenantConfig {
  return vertical === "renovation" ? TENANTS.renovation : TENANTS.demenagement;
}

/** Domaine exact ou sous-domaine délimité, jamais une simple sous-chaîne. */
export function resolveVerticalFromHost(host: string | null): TenantConfig["vertical"] {
  const hostname = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (hostname === "renovation-habitat.fr" || hostname.endsWith(".renovation-habitat.fr") || hostname === "renovation.localhost") return "renovation";
  if (hostname === "demenagement-local.fr" || hostname.endsWith(".demenagement-local.fr") || hostname === "demenagement.localhost") return "demenagement";
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "[::1]") return getTenantConfig().vertical;
  return "demenagement";
}
