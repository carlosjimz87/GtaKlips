import type { ManualCandidate } from "./inbox";
import { categories } from "./model";
export function missingFields(c: ManualCandidate) {
  const fields: string[] = [];
  if (!c.title.trim()) fields.push("título");
  if (!c.streamer.trim()) fields.push("crédito del creador");
  if (!c.text.trim()) fields.push("contexto");
  if (!categories.includes(c.category as any)) fields.push("categoría");
  return fields;
}
export function protectedPatch(
  c: ManualCandidate,
  patch: Record<string, unknown>,
) {
  const sources = JSON.parse(c.field_sources || "{}");
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (sources[key] === "manual") continue;
    const current = (c as any)[key];
    if ((!current || (key === "orientation" && current === "auto")) && value)
      out[key] = value;
  }
  return out;
}
