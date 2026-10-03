export type AddressSelection = { city: string; postalCode: string; department: string; streetAddress: string; label: string };
export function departmentFromPostalCode(postalCode: string): string {
  if (/^97[1-6]/.test(postalCode)) return postalCode.slice(0, 3);
  if (postalCode.startsWith("20")) return ""; // La BAN fournit le code INSEE pour la Corse.
  return /^\d{5}$/.test(postalCode) ? postalCode.slice(0, 2) : "";
}
export function parseAddresses(data: unknown): AddressSelection[] {
  if (!data || typeof data !== "object" || !("features" in data) || !Array.isArray(data.features)) return [];
  return data.features.flatMap((feature: unknown) => {
    if (!feature || typeof feature !== "object" || !("properties" in feature)) return [];
    const p = feature.properties as Record<string, unknown> | null;
    if (!p || typeof p.city !== "string" || typeof p.postcode !== "string" || !/^\d{5}$/.test(p.postcode)
      || typeof p.label !== "string" || !["municipality", "street", "housenumber"].includes(String(p.type))) return [];
    const department = typeof p.depcode === "string" ? p.depcode : typeof p.citycode === "string" && /^2[AB]/.test(p.citycode) ? p.citycode.slice(0, 2) : departmentFromPostalCode(p.postcode);
    if (!/^(?:\d{2}|2[AB]|97[1-6])$/.test(department)) return [];
    return [{ city: p.city, postalCode: p.postcode, department, label: p.label,
      streetAddress: p.type !== "municipality" && typeof p.name === "string" ? p.name : "" }];
  }).slice(0, 5);
}
