import { z } from "zod";

export type Coordinates = [longitude: number, latitude: number];
export type AddressSelection = { city: string; postalCode: string; department: string; streetAddress: string; label: string; coordinates?: Coordinates };
const PropertiesSchema = z.object({
  city: z.string().trim().min(1), postcode: z.string().regex(/^\d{5}$/),
  label: z.string().trim().min(1), type: z.enum(["municipality", "street", "housenumber"]),
  name: z.string().optional(), depcode: z.string().optional(), citycode: z.string().optional(),
});
const GeometrySchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]),
});
export type AddressFeature = { type: "Feature"; properties: z.infer<typeof PropertiesSchema>; geometry?: z.infer<typeof GeometrySchema> | null };
export type AddressFeatureCollection = { type: "FeatureCollection"; features: AddressFeature[] };

export function departmentFromPostalCode(postalCode: string): string {
  if (/^97[1-6]/.test(postalCode)) return postalCode.slice(0, 3);
  if (postalCode.startsWith("20")) return ""; // Utiliser le code INSEE en Corse.
  return /^\d{5}$/.test(postalCode) ? postalCode.slice(0, 2) : "";
}
/** Vérifie chaque suggestion externe ; une entrée malformée ne masque pas les autres. */
export function parseAddresses(data: unknown): AddressSelection[] {
  const collection = z.object({ type: z.literal("FeatureCollection"), features: z.array(z.unknown()) }).safeParse(data);
  if (!collection.success) return [];
  return collection.data.features.flatMap((item): AddressSelection[] => {
    const feature = z.object({ type: z.literal("Feature"), properties: PropertiesSchema, geometry: z.unknown().optional() }).safeParse(item);
    if (!feature.success) return [];
    const p = feature.data.properties;
    const department = /^2[AB]/.test(p.citycode ?? "") ? p.citycode!.slice(0, 2) : departmentFromPostalCode(p.postcode);
    if (!/^(?:\d{2}|2[AB]|97[1-6])$/.test(department)) return [];
    const geometry = GeometrySchema.safeParse(feature.data.geometry);
    return [{ city: p.city, postalCode: p.postcode, department, label: p.label,
      streetAddress: p.type !== "municipality" ? p.name ?? "" : "",
      ...(geometry.success ? { coordinates: geometry.data.coordinates } : {}),
    }];
  }).slice(0, 5);
}
