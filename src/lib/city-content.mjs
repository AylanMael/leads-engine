import { z } from "zod";

export const SIMILARITY_THRESHOLD = 0.25;
export const ContentSchema = z.object({
  headline: z.string().trim().min(15).max(200),
  accessNotice: z.string().trim().min(80).max(1600),
  faq: z.array(z.object({
    question: z.string().trim().min(10).max(250),
    answer: z.string().trim().min(40).max(1200),
  }).strict()).length(3),
}).strict();

export const GeneratedCityContentSchema = ContentSchema.extend({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  vertical: z.enum(["demenagement", "renovation"]),
  departmentCode: z.string().regex(/^(?:[0-9]{2,3}|2[AB])$/),
  generation: z.object({
    model: z.string().min(1),
    generatedAt: z.iso.datetime(),
    attempts: z.number().int().min(1).max(3),
    maxSimilarity: z.number().min(0).max(SIMILARITY_THRESHOLD),
    sourceHash: z.string().min(1),
  }).strict(),
}).strict();

export function normalize(text) {
  return text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/œ/g, "oe").replace(/æ/g, "ae");
}

export function wordTrigrams(text) {
  const words = normalize(text).match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words.slice(0, -2).map((_, index) => words.slice(index, index + 3).join(" ")));
}

export function jaccard(left, right) {
  const a = typeof left === "string" ? wordTrigrams(left) : left;
  const b = typeof right === "string" ? wordTrigrams(right) : right;
  const intersection = [...a].filter((gram) => b.has(gram)).length;
  const union = a.size + b.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

export function contentText(content) {
  return [content.headline, content.accessNotice, ...content.faq.flatMap(({ question, answer }) => [question, answer])].join("\n");
}

export function validateContent(raw) {
  const content = ContentSchema.parse(raw);
  const text = contentText(content);
  if (/<[^>]*>|```/.test(text)) throw new Error("HTML ou Markdown interdit");
  if (/nichee|au coeur de|veritable ecrin|havre de paix|il est important de|que vous soyez|plongez dans|en somme/.test(normalize(text))) throw new Error("Cliché rédactionnel interdit");
  if (/a enrichir/.test(normalize(text))) throw new Error("Placeholder éditorial interdit");
  if (new Set(content.faq.map(({ question }) => normalize(question))).size !== 3) throw new Error("Questions FAQ dupliquées");
  return content;
}

export function closestMatch(content, city, accepted) {
  const grams = wordTrigrams(contentText(content));
  let closest = { score: 0, slug: null };
  for (const previous of accepted) {
    if (previous.departmentCode !== city.departmentCode || previous.slug === city.slug) continue;
    const score = jaccard(grams, wordTrigrams(contentText(previous)));
    if (score > closest.score) closest = { score, slug: previous.slug };
  }
  return closest;
}

/** Recalcul au build : les scores enregistrés ne sont pas acceptés sur parole. */
export function validateCatalogue(raw, vertical, departmentCode = "78") {
  const rows = GeneratedCityContentSchema.array().parse(raw);
  const seen = new Set();
  for (const [index, row] of rows.entries()) {
    if (row.vertical !== vertical || row.departmentCode !== departmentCode || seen.has(row.slug)) throw new Error("Catalogue : vertical, département ou slug invalide");
    seen.add(row.slug);
    validateContent({ headline: row.headline, accessNotice: row.accessNotice, faq: row.faq });
    const nearest = closestMatch(row, row, rows.slice(0, index));
    if (nearest.score > SIMILARITY_THRESHOLD) throw new Error(`Similarité excessive entre ${row.slug} et ${nearest.slug}`);
  }
  return rows;
}
