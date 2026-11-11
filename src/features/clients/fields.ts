// Clients step 2 (decision 026): the business's own client fields, the list's
// optional columns, and group thresholds. Pure — used on server and client.
import { z } from "zod";

export const fieldKinds = ["text", "number", "date", "choice", "yesno"] as const;
export type FieldKind = (typeof fieldKinds)[number];
export type ClientField = { id: string; label: string; kind: FieldKind; options: string[] };
export type CustomValues = Record<string, string | number | boolean>;

export const MAX_FIELDS = 20;

export const clientFieldSchema = z
  .object({
    label: z.string().trim().min(1, "required").max(60, "tooLong"),
    kind: z.enum(fieldKinds),
    options: z.array(z.string().trim().min(1).max(40)).max(20),
  })
  .transform((f) => ({ ...f, options: f.kind === "choice" ? [...new Set(f.options)] : [] }))
  .refine((f) => f.kind !== "choice" || f.options.length > 0, {
    message: "optionsRequired",
    path: ["options"],
  });
export type ClientFieldInput = z.input<typeof clientFieldSchema>;

/**
 * Keeps only values for fields that exist, in the right type; empty values are
 * dropped. Anything else (an old field, a wrong type) is ignored, never stored.
 */
export function cleanCustom(input: unknown, fields: ClientField[]): CustomValues {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: CustomValues = {};
  for (const f of fields) {
    const v = raw[f.id];
    if (v === undefined || v === null || v === "") continue;
    if (f.kind === "yesno") {
      if (typeof v === "boolean") out[f.id] = v;
    } else if (f.kind === "number") {
      const n = typeof v === "number" ? v : Number(String(v).trim().replace(",", "."));
      if (Number.isFinite(n) && Math.abs(n) < 1e9) out[f.id] = n;
    } else if (f.kind === "date") {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) out[f.id] = v;
    } else if (f.kind === "choice") {
      if (typeof v === "string" && f.options.includes(v)) out[f.id] = v;
    } else if (typeof v === "string" && v.trim()) {
      out[f.id] = v.trim().slice(0, 500);
    }
  }
  return out;
}

// ----- the list's columns (chosen per browser, kept in a cookie) -----

export const baseColumns = [
  "phone",
  "group",
  "lastVisit",
  "nextVisit",
  "visits",
  "spent",
  "average",
] as const;
export type BaseColumn = (typeof baseColumns)[number];
export const MONEY_COLUMNS: readonly string[] = ["spent", "average"];
export const COLUMNS_COOKIE = "vc_client_cols";

/** Columns from the cookie: base names and "f:<field id>"; unknown ones dropped. Null = never chosen. */
export function parseColumns(value: string | undefined, fields: ClientField[]): string[] | null {
  if (value === undefined) return null;
  const ids = new Set(fields.map((f) => `f:${f.id}`));
  return value
    .split(",")
    .filter((c) => (baseColumns as readonly string[]).includes(c) || ids.has(c))
    .filter((c, i, all) => all.indexOf(c) === i);
}

/** What the list shows: the chosen columns (or all base ones), money only for people who may see it. */
export function visibleColumns(chosen: string[] | null, money: boolean): string[] {
  return (chosen ?? [...baseColumns]).filter((c) => money || !MONEY_COLUMNS.includes(c));
}

// ----- group thresholds -----

export const segmentRulesSchema = z
  .object({
    vipVisits: z.coerce.number<string | number>().int().min(2).max(100),
    atRiskDays: z.coerce.number<string | number>().int().min(14).max(365),
    lostDays: z.coerce.number<string | number>().int().min(30).max(1095),
  })
  .refine((r) => r.lostDays > r.atRiskDays, { message: "lostAfterAtRisk", path: ["lostDays"] });
export type SegmentRulesInput = z.input<typeof segmentRulesSchema>;
export type SegmentRules = z.output<typeof segmentRulesSchema>;
export const DEFAULT_RULES: SegmentRules = { vipVisits: 5, atRiskDays: 60, lostDays: 180 };
