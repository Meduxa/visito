import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const branchSchema = z.object({
  name: z.string().trim().min(1, "required").max(120, "tooLong"),
  address: z.string().trim().max(300, "tooLong"),
  phone: z
    .string()
    .trim()
    .refine((s) => !s || normalizePhone(s) !== null, "phoneInvalid")
    .transform((s) => (s ? normalizePhone(s) : null)),
  // the end of the branch's own booking link: latin letters, digits, dashes
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine((s) => s === "" || /^[a-z0-9][a-z0-9-]{0,38}[a-z0-9]$/.test(s), "branchSlugInvalid"),
});
export type BranchInput = z.input<typeof branchSchema>;

const price = z.number().int().min(0).max(100_000_000).nullable();

// Per service: offered here? Own price here? Only rows that differ from normal are kept.
export const branchServicesSchema = z
  .array(
    z.object({
      serviceId: z.uuid(),
      offered: z.boolean(),
      priceMinor: price,
      priceMaxMinor: price,
    }),
  )
  .max(1000);
export type BranchServicesInput = z.input<typeof branchServicesSchema>;
