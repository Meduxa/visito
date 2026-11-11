import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

export const slotSteps = [5, 10, 15, 20, 30, 60] as const;

const int = (min: number, max: number) =>
  z.coerce.number<string | number>().int("invalidInput").min(min, "invalidInput").max(max, "invalidInput");

export const businessSchema = z.object({
  name: z.string().trim().min(2, "nameMin").max(120, "tooLong"),
  address: z.string().trim().max(300, "tooLong"),
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
});
export type BusinessInput = z.input<typeof businessSchema>;

// Entered in hours/days for people; stored in minutes.
export const bookingRulesSchema = z.object({
  minNoticeHours: int(0, 168),
  maxDaysAhead: int(1, 365),
  cancelWindowHours: int(0, 168),
  slotStepMin: z.coerce
    .number<string | number>()
    .refine((n) => (slotSteps as readonly number[]).includes(n), "invalidInput"),
  onlineRequiresApproval: z.boolean(),
  onlineOtpRequired: z.boolean(),
  onlineShowPrices: z.boolean(),
  maxUpcoming: int(0, 20),
});
export type BookingRulesInput = z.input<typeof bookingRulesSchema>;

// What staff may see; whether admins see money (that one only the owner sets).
export const accessSchema = z.object({
  staffSeesAllClients: z.boolean(),
  staffSeesAllBookings: z.boolean(),
  adminsSeeRevenue: z.boolean(),
});
export type AccessInput = z.input<typeof accessSchema>;

// Settings → Notifications: who is told about what (decision 021).
export const notifySchema = z.object({
  onlineManagers: z.boolean(),
  onlineStaff: z.boolean(),
  overdueManagers: z.boolean(),
  overdueStaff: z.boolean(),
});
export type NotifyInput = z.input<typeof notifySchema>;

export const closureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid"),
  reason: z.string().trim().max(200, "tooLong"),
});

export const resourceSchema = z.object({
  name: z.string().trim().min(1, "required").max(80, "tooLong"),
  type: z.enum(["chair", "room", "equipment"]),
});
