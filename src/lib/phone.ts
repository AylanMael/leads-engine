import { z } from "zod";

/** Normalise les séparateurs usuels et l'indicatif français, sans masquer les lettres. */
export function normalizePhone(value: string): string {
  return value.replace(/[\s.()-]/g, "").replace(/^(?:\+33|0033)/, "0");
}
export function formatPhone(value: string): string {
  const normalized = normalizePhone(value);
  return /^\d*$/.test(normalized) ? normalized.replace(/(\d{2})(?=\d)/g, "$1 ") : value;
}
export function isValidPhone(value: string): boolean {
  const phone = normalizePhone(value);
  return /^0[1-79]\d{8}$/.test(phone)
    && !/^(\d{2})\1{3}$/.test(phone.slice(2))
    && !["01234567", "12345678", "23456789", "98765432", "87654321", "76543210"].includes(phone.slice(2));
}
export const PhoneSchema = z.string().transform(normalizePhone).refine(isValidPhone,
  "Saisissez un téléphone français valide (01 à 07 ou 09), sans suite artificielle.");
