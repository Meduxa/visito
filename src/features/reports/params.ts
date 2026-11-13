// The report's filters as they appear in the address
// (?from=&to=&staff=&branch=&compare=&tab=). Default: this month up to today, no
// comparison, the overview tab. Ranges longer than a year are cut.
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/;

export const REPORT_TABS = ["overview", "revenue", "payments", "services", "clients", "staff"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];
export const COMPARE_MODES = ["off", "previous", "year"] as const;
export type CompareMode = (typeof COMPARE_MODES)[number];

const noon = (d: string) => Date.parse(`${d}T12:00:00Z`);
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const shiftDays = (d: string, n: number) => ymd(noon(d) + n * 86_400_000);

export function reportParams(sp: Record<string, string | string[] | undefined>, today: string) {
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]) ?? "";
  let from = DATE.test(one("from")) ? one("from") : `${today.slice(0, 8)}01`;
  let to = DATE.test(one("to")) ? one("to") : today;
  if (from > to) [from, to] = [to, from];
  const maxFrom = shiftDays(to, -366);
  if (from < maxFrom) from = maxFrom;
  const staff = UUID.test(one("staff")) ? one("staff") : null;
  const branch = UUID.test(one("branch")) ? one("branch") : null; // decision 032
  const compare = (COMPARE_MODES as readonly string[]).includes(one("compare"))
    ? (one("compare") as CompareMode)
    : "off";
  const tab = (REPORT_TABS as readonly string[]).includes(one("tab"))
    ? (one("tab") as ReportTab)
    : "overview";
  return { from, to, staff, branch, compare, tab };
}

/** The same date one year earlier (29 February becomes 28 February). */
function lastYear(d: string) {
  const y = Number(d.slice(0, 4)) - 1;
  const md = d.slice(5) === "02-29" ? "02-28" : d.slice(5);
  return `${y}-${md}`;
}

/**
 * The period to compare with: the same number of days right before ("previous"),
 * or the same dates a year earlier ("year").
 */
export function comparisonRange(from: string, to: string, mode: CompareMode) {
  if (mode === "off") return null;
  if (mode === "year") return { from: lastYear(from), to: lastYear(to) };
  const length = Math.round((noon(to) - noon(from)) / 86_400_000);
  const prevTo = shiftDays(from, -1);
  return { from: shiftDays(prevTo, -length), to: prevTo };
}

/** Change from `before` to `now` in %, one decimal; null when there is nothing to compare with. */
export function changePct(now: number | null, before: number | null) {
  if (now === null || before === null || before === 0) return null;
  return Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
}
