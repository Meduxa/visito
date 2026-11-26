import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const DEFAULT_TZ = "Asia/Tbilisi";

// 1 = Monday … 7 = Sunday (ISO), as stored in the database.
export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type Interval = { start: string; end: string }; // "HH:MM"

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

// Problems with one day's working intervals, or null when they are fine.
export function intervalProblem(intervals: Interval[]): "badTime" | "endBeforeStart" | "overlap" | null {
  if (intervals.some((i) => !isTime(i.start) || !isTime(i.end))) return "badTime";
  if (intervals.some((i) => toMinutes(i.end) <= toMinutes(i.start))) return "endBeforeStart";
  const sorted = [...intervals].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) return "overlap";
  }
  return null;
}

/** A working interval that does not fit inside any of the opening intervals (none = closed that day). */
export const outsideHours = (iv: Interval, open: Interval[]) =>
  isTime(iv.start) &&
  isTime(iv.end) &&
  !open.some((o) => toMinutes(o.start) <= toMinutes(iv.start) && toMinutes(iv.end) <= toMinutes(o.end));

// "2027-02-01" + "10:00" in the business's time zone → UTC ISO string for timestamptz.
export function zonedToUtcIso(date: string, time: string, tz = DEFAULT_TZ): string {
  return fromZonedTime(`${date}T${time}`, tz).toISOString();
}

export function utcToZoned(iso: string, tz = DEFAULT_TZ) {
  return { date: formatInTimeZone(iso, tz, "yyyy-MM-dd"), time: formatInTimeZone(iso, tz, "HH:mm") };
}

// Postgres "time" comes back as "10:00:00"; the UI uses "10:00".
export const trimSeconds = (t: string) => t.slice(0, 5);
