import { z } from "zod";
import { parseMoneyToMinor } from "@/lib/money";

export const staffColors = [
  "green",
  "teal",
  "sky",
  "blue",
  "indigo",
  "violet",
  "pink",
  "rose",
  "orange",
  "amber",
] as const;
export const priceTypes = ["fixed", "from", "range"] as const;
export const resourceTypes = ["chair", "room", "equipment"] as const;

const text = (max: number) => z.string().trim().max(max, "tooLong");

// {ka, en, ru}: at least one language filled in.
export const i18nName = z
  .object({ ka: text(300).optional(), en: text(300).optional(), ru: text(300).optional() })
  .refine((v) => Object.values(v).some((s) => s && s.trim()), { message: "nameRequired" });

export const i18nDescription = z.object({
  ka: text(2000).optional(),
  en: text(2000).optional(),
  ru: text(2000).optional(),
});

// Money is typed as text ("55", "55,50") and becomes integer tetri.
const money = z
  .string()
  .trim()
  .refine((s) => parseMoneyToMinor(s) !== null, "priceInvalid")
  .transform((s) => parseMoneyToMinor(s)!);

const minutes = (min: number, max: number) =>
  z.coerce
    .number<string | number>()
    .int("minutesInvalid")
    .min(min, "minutesInvalid")
    .max(max, "minutesInvalid");

export const serviceSchema = z
  .object({
    name: i18nName,
    description: i18nDescription,
    categoryId: z.uuid().nullable(),
    priceType: z.enum(priceTypes),
    price: money,
    priceMax: z.string().trim().optional(),
    durationMin: minutes(5, 720),
    bufferAfterMin: minutes(0, 240),
    active: z.boolean(),
    bookableOnline: z.boolean(),
    color: z.enum(staffColors).nullable(),
    resourceType: z.enum(resourceTypes).nullable(),
    // "requires an additional service" (decision 037): which one, and minutes after this one ends
    followUpServiceId: z.uuid().nullable().optional(),
    followUpAfterMin: minutes(0, 720).optional(),
  })
  .transform((v, ctx) => {
    let priceMaxMinor: number | null = null;
    if (v.priceType === "range") {
      priceMaxMinor = v.priceMax ? parseMoneyToMinor(v.priceMax) : null;
      if (priceMaxMinor === null || priceMaxMinor <= v.price) {
        ctx.addIssue({ code: "custom", path: ["priceMax"], message: "priceMaxInvalid" });
        return z.NEVER;
      }
    }
    return { ...v, priceMaxMinor };
  });

export type ServiceInput = z.input<typeof serviceSchema>;

export const extraSchema = z.object({
  name: i18nName,
  price: money,
  durationMin: minutes(0, 720),
});
export type ExtraInput = z.input<typeof extraSchema>;

export const categorySchema = z.object({ name: i18nName });
export type CategoryInput = z.input<typeof categorySchema>;

// Rows coming back from the import preview (re-validated on the server).
export const importRowSchema = z.object({
  category: z.string().trim().max(300).nullable(),
  name: z.string().trim().min(1).max(300),
  price_type: z.enum(priceTypes),
  price_minor: z.number().int().min(0).max(100_000_000),
  price_max_minor: z.number().int().min(0).max(100_000_000).nullable(),
  duration_min: z.number().int().min(5).max(720),
});
export const importSchema = z.array(importRowSchema).min(1).max(1000);
