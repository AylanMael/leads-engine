import yvelines from "./cities-78.json";
import hautsDeSeine from "./cities-92.json";
import paris from "./cities-75.json";

/** Source géographique unique pour les routes, le maillage et le sitemap. */
export const ALL_CITIES = [...yvelines, ...hautsDeSeine, ...paris];
export const DEPARTMENTS = [
  { code: "78", name: "Yvelines", cities: yvelines },
  { code: "92", name: "Hauts-de-Seine", cities: hautsDeSeine },
  { code: "75", name: "Paris", cities: paris },
];
