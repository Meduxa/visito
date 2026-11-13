import { z } from "zod";
import { staffColors } from "@/features/services/schema";
import { parseMoneyToMinor } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { intervalProblem, isTime, WEEKDAYS } from "@/lib/time";

export const positionTypes = ["master", "doctor", "assistant", "other"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "tooLong")
    .transform((s) => s || null);

export const staffSchema = z.object({
  displayName: z.string().trim().min(1, "required").max(120, "tooLong"),
  position: optionalText(120),
  positionType: z.enum(positionTypes),
  color: z.enum(staffColors),
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
  bio: optionalText(1000),
  bookableOnline: z.boolean(),
  active: z.boolean(),
  commissionPct: z.coerce.number<string | number>().min(0, "percentInvalid").max(100, "percentInvalid"),
});
export type StaffInput = z.input<typeof staffSchema>;

const interval = z.object({
  start: z.string().refine(isTime),
  end: z.string().refine(isTime),
  locationId: z.uuid().optional(), // the branch (staff schedules, decision 032)
});

export const weekSchema = z
  .record(z.string(), z.array(interval).max(10))
  .refine(
    (week) =>
      Object.entries(week).every(
        ([day, list]) => WEEKDAYS.includes(Number(day) as never) && intervalProblem(list) === null,
      ),
    "scheduleInvalid",
  );
export type WeekInput = Record<string, { start: string; end: string; locationId?: string }[]>;

// Services this person performs; empty override = use the service's own value.
export const staffServicesSchema = z
  .array(
    z.object({
      serviceId: z.uuid(),
      price: z.string().trim(),
      duration: z.string().trim(),
    }),
  )
  .max(1000)
  .transform((rows, ctx) =>
    rows.map((r) => {
      const price = r.price ? parseMoneyToMinor(r.price) : null;
      const duration = r.duration ? Number(r.duration) : null;
      if (
        (r.price && price === null) ||
        (duration !== null && !(Number.isInteger(duration) && duration >= 5 && duration <= 720))
      ) {
        ctx.addIssue({ code: "custom", message: "invalidInput" });
      }
      return { service_id: r.serviceId, price_minor_override: price, duration_min_override: duration };
    }),
  );
export type StaffServicesInput = z.input<typeof staffServicesSchema>;

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateInvalid");

export const overrideSchema = z
  .object({
    date: dateSchema,
    dayOff: z.boolean(),
    start: z.string(),
    end: z.string(),
    locationId: z.uuid().nullable().optional(), // the branch of that day (decision 032)
  })
  .refine((v) => v.dayOff || intervalProblem([{ start: v.start, end: v.end }]) === null, {
    message: "timeInvalid",
    path: ["end"],
  });
export type OverrideInput = z.input<typeof overrideSchema>;

export const timeOffReasons = ["vacation", "sick", "break", "other"] as const;

export const timeOffSchema = z
  .object({
    startDate: dateSchema,
    startTime: z.string().refine(isTime, "timeInvalid"),
    endDate: dateSchema,
    endTime: z.string().refine(isTime, "timeInvalid"),
    reason: z.enum(timeOffReasons),
    note: optionalText(300),
  })
  .refine((v) => `${v.endDate}T${v.endTime}` > `${v.startDate}T${v.startTime}`, {
    message: "endBeforeStart",
    path: ["endDate"],
  });
export type TimeOffInput = z.input<typeof timeOffSchema>;
