import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const PAGE_SIZE = 50;

export const clientSources = [
  "walk_in",
  "phone",
  "instagram",
  "facebook",
  "referral",
  "online",
  "import",
  "other",
] as const;
export const genders = ["female", "male", "other"] as const;

const opt = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .transform((s) => s || null);

export const clientSchema = z.object({
  firstName: z.string().trim().min(1, "required").max(80, "tooLong"),
  lastName: opt(80),
  phone: z
    .string()
    .trim()
    .refine((s) => !s || normalizePhone(s) !== null, "phoneInvalid")
    .transform((s) => (s ? normalizePhone(s) : null)),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((s) => !s || z.email().safeParse(s).success, "email")
    .transform((s) => s || null),
  birthday: z
    .string()
    .refine((s) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s), "dateInvalid")
    .transform((s) => s || null),
  gender: z.enum(genders).nullable(),
  source: z.enum(clientSources).nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20),
  notes: opt(4000),
  importantNote: opt(500),
  preferredStaffId: z.uuid().nullable(),
  blockedOnline: z.boolean(),
  // marketing consent as currently ticked; a change is stored as a new event
  consentSms: z.boolean(),
  consentEmail: z.boolean(),
  // own fields (decision 026): checked against the business's fields on the server
  custom: z.record(z.string(), z.unknown()).optional(),
});
export type ClientInput = z.input<typeof clientSchema>;

export const importClientRow = z.object({
  first_name: z.string().trim().min(1).max(80),
  last_name: z.string().trim().max(80).nullable(),
  phone_e164: z
    .string()
    .regex(/^\+[1-9][0-9]{7,14}$/)
    .nullable(),
  email: z.string().max(200).nullable(),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  notes: z.string().max(4000).nullable(),
  consent_sms: z.boolean(),
  consent_email: z.boolean(),
});
export const importClientsSchema = z.array(importClientRow).min(1).max(5000);

// ----- Client list: groups, filters and sorting (decision 024) -----

export const segments = ["new", "regular", "vip", "at_risk", "lost"] as const;
export type Segment = (typeof segments)[number];
export const clientSorts = ["added", "name", "last_visit", "visits", "spent"] as const;
export type ClientSort = (typeof clientSorts)[number];

/** The list's view lives in the address (?segment=…&sort=…); anything unknown falls back to the default. */
export const clientListParams = z.object({
  q: z.string().max(100).catch(""),
  page: z.coerce.number().int().min(0).max(10_000).catch(0),
  segment: z.enum(segments).optional().catch(undefined),
  tag: z.string().trim().min(1).max(40).optional().catch(undefined),
  upcoming: z.literal("1").optional().catch(undefined),
  birthday: z.literal("1").optional().catch(undefined),
  noshow: z.literal("1").optional().catch(undefined),
  sort: z.enum(clientSorts).catch("added"),
});
export type ClientListParams = z.infer<typeof clientListParams>;
