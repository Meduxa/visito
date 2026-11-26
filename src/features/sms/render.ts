import { fromZonedTime } from "date-fns-tz";
import { ymdIn } from "@/lib/date-format";
import { trimSeconds } from "@/lib/time";

// SMS templates use {variables} that the business can move around freely.
export const SMS_VARIABLES = [
  "client_name",
  "business_name",
  "place", // the business, plus the branch when it has several
  "service",
  "staff",
  "date",
  "time",
  "address",
  "phone",
  "manage_link",
] as const;
export type SmsVariable = (typeof SMS_VARIABLES)[number];
export type SmsVars = Partial<Record<SmsVariable, string>>;

export const TEMPLATE_TYPES = ["confirmed", "pending", "reminder", "rescheduled", "cancelled"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

/** Fills known variables; unknown {words} stay as typed so mistakes are visible in the preview. */
export function renderSms(template: string, vars: SmsVars): string {
  return template
    .replace(/\{([a-z_]+)\}/g, (whole, name: string) =>
      (SMS_VARIABLES as readonly string[]).includes(name) ? (vars[name as SmsVariable] ?? "") : whole,
    )
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/** Variables used in a template that we do not know (shown as a warning in the editor). */
export const unknownVariables = (template: string) =>
  [...template.matchAll(/\{([a-z_]+)\}/g)]
    .map((m) => m[1])
    .filter((n) => !(SMS_VARIABLES as readonly string[]).includes(n));

/** Is `now` (minutes since local midnight) inside quiet hours, which may cross midnight? */
export function inQuietHours(nowMin: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return false;
  return startMin < endMin ? nowMin >= startMin && nowMin < endMin : nowMin >= startMin || nowMin < endMin;
}

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** When the message may go out: now, or at the end of quiet hours; null = too late, skip. */
export function sendTime(
  now: Date,
  tz: string,
  quiet: { start: string; end: string },
  deadline: Date,
): Date | null {
  const local = ymdIn(now.toISOString(), tz);
  const hm = now.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const nowMin = toMin(hm);
  const [s, e] = [toMin(quiet.start), toMin(quiet.end)];
  if (!inQuietHours(nowMin, s, e)) return now;
  // the quiet period ends today (after midnight) or tomorrow (before midnight)
  const endDay = nowMin < e ? local : ymdIn(new Date(now.getTime() + 86_400_000).toISOString(), tz);
  const at = fromZonedTime(`${endDay}T${trimSeconds(quiet.end)}`, tz);
  return at < deadline ? at : null;
}
