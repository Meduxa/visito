import { z } from "zod";

const money = z.string().trim().max(15);
const pct = z.coerce.number<string | number>().min(0).max(100).multipleOf(0.01);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const note = z
  .string()
  .trim()
  .max(200)
  .transform((s) => s || null);

export const paySchemeSchema = z.object({
  salary: money, // ₾ per month, "" = none
  defaultPct: pct,
});
export type PaySchemeInput = z.input<typeof paySchemeSchema>;

export const payRateSchema = z.object({
  target: z.enum(["category", "service"]),
  targetId: z.uuid(),
  pct,
});
export type PayRateInput = z.input<typeof payRateSchema>;

export const adjustmentSchema = z.object({
  staffId: z.uuid(),
  month,
  kind: z.enum(["bonus", "deduction"]),
  amount: money,
  note,
});
export type AdjustmentInput = z.input<typeof adjustmentSchema>;

export const payoutMethods = ["cash", "transfer", "card"] as const;
export const payoutSchema = z.object({
  staffId: z.uuid(),
  month,
  amount: money,
  method: z.enum(payoutMethods),
  paidOn: z.iso.date(),
  note,
});
export type PayoutInput = z.input<typeof payoutSchema>;
