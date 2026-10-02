import { getSiteConfig } from "./site";

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
    theme: {
      accent: "text-emerald-800",
      button: "bg-emerald-800 text-white hover:bg-emerald-900 focus-visible:ring-emerald-700",
      badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    },
    labels: {
      mainTitle: "Donnez vie à vos projets de rénovation.",
      tagline: "Une seule demande, jusqu’à 2 devis locaux, sans spam commercial.",
      matchingPromise: "Un artisan local vous contacte sous 24h pour échanger sur vos travaux.",
    },
  },
} as const satisfies Record<TenantConfig["vertical"], Omit<TenantConfig, "brandName" | "legalEntity">>;

/** Résolution pure partagée ; passer la marque de la requête en multi-domaines. */
export function getTenantConfig(vertical: string | null | undefined = process.env.NEXT_PUBLIC_VERTICAL): TenantConfig {
  const site = getSiteConfig(vertical);
  const tenant = TENANTS[site.vertical];
  return { ...tenant, brandName: site.brandName, legalEntity: site.legalName, labels: { ...tenant.labels, mainTitle: site.tagline, tagline: site.description } };
}

/** Domaine exact ou sous-domaine délimité, jamais une simple sous-chaîne. */
export function resolveVerticalFromHost(host: string | null): TenantConfig["vertical"] {
  const hostname = (host ?? "").trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (hostname === "renovizo.fr" || hostname.endsWith(".renovizo.fr") || hostname === "renovation-habitat.fr" || hostname.endsWith(".renovation-habitat.fr") || hostname === "renovation.localhost") return "renovation";
  if (hostname === "demenizo.fr" || hostname.endsWith(".demenizo.fr") || hostname === "demenagement-local.fr" || hostname.endsWith(".demenagement-local.fr") || hostname === "demenagement.localhost") return "demenagement";
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "[::1]") return getTenantConfig().vertical;
  return "demenagement";
}
