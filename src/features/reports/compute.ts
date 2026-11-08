// Business reports from raw rows. Pure: the loader (report.ts) fetches, this counts.
// Money is integer tetri throughout.

export type RBooking = {
  id: string;
  status: string;
  source: string;
  clientId: string | null;
  date: string; // local date of the visit
  items: {
    staffId: string;
    serviceKey: string;
    serviceName: string;
    categoryId: string | null;
    priceMinor: number;
    minutes: number;
  }[];
};
export type RPayment = {
  date: string;
  method: string;
  amountMinor: number;
  tipMinor: number;
  bookingId: string;
};
export type RStaff = { id: string; name: string; commissionPct: number; workingMinutes: number };

export type ReportInput = {
  bookings: RBooking[]; // visits in the range
  payments: RPayment[]; // paid payments received in the range
  staff: RStaff[]; // working minutes in the range already summed by the loader
  categories: Record<string, string>;
  /** every client's completed visit dates (all time), for new/returning and retention */
  clientVisits: Record<string, string[]>;
  from: string;
  to: string;
  today: string; // local date, for retention windows
};

const BOOKED = ["pending", "confirmed", "arrived", "in_progress", "completed"];
const CANCELLED = ["cancelled_by_client", "cancelled_by_business"];

const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
const days = (a: string, b: string) =>
  (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000;
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : null);

/** Charts over time use days for up to ~2 months, months for longer periods. */
export type Bucket = "day" | "month";
export const bucketFor = (from: string, to: string): Bucket => (days(from, to) > 62 ? "month" : "day");
const bucketKey = (date: string, bucket: Bucket) => (bucket === "month" ? date.slice(0, 7) : date);
/** Every day ("2026-10-05") or month ("2026-10") of the period, in order, empty ones included. */
export function bucketKeys(from: string, to: string, bucket: Bucket) {
  const keys: string[] = [];
  for (let ms = Date.parse(`${from}T12:00:00Z`); ; ms += 86_400_000) {
    const d = new Date(ms).toISOString().slice(0, 10);
    if (d > to) break;
    const k = bucketKey(d, bucket);
    if (keys.at(-1) !== k) keys.push(k);
  }
  return keys;
}

export function computeReport(r: ReportInput) {
  // ----- money received (payments) -----
  const byDay = new Map<string, number>();
  const byMethod = new Map<string, number>();
  let received = 0;
  let tips = 0;
  for (const p of r.payments) {
    received += p.amountMinor;
    tips += p.tipMinor;
    add(byDay, p.date, p.amountMinor);
    add(byMethod, p.method, p.amountMinor);
  }
  const paidBookings = new Set(r.payments.map((p) => p.bookingId)).size;

  // ----- over time: money received (by method) and bookings that still stand -----
  const bucket = bucketFor(r.from, r.to);
  const series = new Map(
    bucketKeys(r.from, r.to, bucket).map((key) => [
      key,
      { key, receivedMinor: 0, bookings: 0, byMethod: {} as Record<string, number> },
    ]),
  );
  for (const p of r.payments) {
    const row = series.get(bucketKey(p.date, bucket));
    if (!row) continue;
    row.receivedMinor += p.amountMinor;
    row.byMethod[p.method] = (row.byMethod[p.method] ?? 0) + p.amountMinor;
  }
  const tipsByMethod = new Map<string, number>();
  for (const p of r.payments) add(tipsByMethod, p.method, p.tipMinor);

  // ----- visits -----
  const statusCount = new Map<string, number>();
  const activeByDay = new Map<string, number>(); // bookings that still stand, per day
  const sourceCount = new Map<string, number>();
  for (const b of r.bookings) {
    add(statusCount, b.status, 1);
    if (!CANCELLED.includes(b.status)) {
      add(activeByDay, b.date, 1);
      const row = series.get(bucketKey(b.date, bucket));
      if (row) row.bookings += 1;
    }
    add(sourceCount, b.source, 1);
  }
  const completed = r.bookings.filter((b) => b.status === "completed");
  const noShows = statusCount.get("no_show") ?? 0;
  const cancelled = CANCELLED.reduce((a, s) => a + (statusCount.get(s) ?? 0), 0);

  // service value of completed visits, by staff / service / category
  const staffValue = new Map<string, number>();
  const serviceAgg = new Map<string, { name: string; count: number; valueMinor: number }>();
  const categoryValue = new Map<string, number>();
  const categoryCount = new Map<string, number>();
  for (const b of completed)
    for (const i of b.items) {
      add(staffValue, i.staffId, i.priceMinor);
      const s = serviceAgg.get(i.serviceKey) ?? { name: i.serviceName, count: 0, valueMinor: 0 };
      s.count += 1;
      s.valueMinor += i.priceMinor;
      serviceAgg.set(i.serviceKey, s);
      add(categoryValue, i.categoryId ?? "", i.priceMinor);
      add(categoryCount, i.categoryId ?? "", 1);
    }

  // occupancy: booked minutes (not cancelled / no-show) ÷ working minutes
  const bookedMinutes = new Map<string, number>();
  for (const b of r.bookings.filter((x) => BOOKED.includes(x.status)))
    for (const i of b.items) add(bookedMinutes, i.staffId, i.minutes);

  const staff = r.staff.map((s) => {
    const value = staffValue.get(s.id) ?? 0;
    return {
      id: s.id,
      name: s.name,
      valueMinor: value,
      commissionMinor: Math.round((value * s.commissionPct) / 100),
      bookedMinutes: bookedMinutes.get(s.id) ?? 0,
      workingMinutes: s.workingMinutes,
      occupancyPct: pct(bookedMinutes.get(s.id) ?? 0, s.workingMinutes),
    };
  });
  const totalBooked = staff.reduce((a, s) => a + s.bookedMinutes, 0);
  const totalWorking = staff.reduce((a, s) => a + s.workingMinutes, 0);

  // ----- clients: new vs returning, retention -----
  const inRange = new Set(completed.map((b) => b.clientId).filter((c): c is string => !!c));
  let newClients = 0;
  const WINDOWS = [30, 60, 90] as const;
  const back = { 30: 0, 60: 0, 90: 0 };
  const base = { 30: 0, 60: 0, 90: 0 };
  for (const c of inRange) {
    const visits = [...(r.clientVisits[c] ?? [])].sort();
    const first = visits[0];
    if (!first || first < r.from || first > r.to) continue; // came before: returning
    newClients++;
    const next = visits.find((v) => v > first);
    const gap = next ? days(first, next) : Infinity;
    // a window counts only clients who have had that much time to come back
    for (const w of WINDOWS) {
      if (days(first, r.today) < w) continue;
      base[w]++;
      if (gap <= w) back[w]++;
    }
  }

  return {
    money: {
      receivedMinor: received,
      tipsMinor: tips,
      averageTicketMinor: paidBookings ? Math.round(received / paidBookings) : null,
      byDay: [...byDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, minor]) => ({ date, minor })),
      byMethod: [...byMethod.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([method, minor]) => ({ method, minor, tipsMinor: tipsByMethod.get(method) ?? 0 })),
      byCategory: [...categoryValue.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([id, minor]) => ({ name: r.categories[id] ?? "", minor, count: categoryCount.get(id) ?? 0 })),
    },
    bucket,
    series: [...series.values()],
    bookings: {
      total: r.bookings.length,
      completed: completed.length,
      byStatus: Object.fromEntries(statusCount),
      activeByDay: Object.fromEntries(activeByDay),
      bySource: Object.fromEntries(sourceCount),
      noShowRatePct: pct(noShows, completed.length + noShows),
      cancellationRatePct: pct(cancelled, r.bookings.length),
    },
    staff: staff.sort((a, b) => b.valueMinor - a.valueMinor),
    occupancyPct: pct(totalBooked, totalWorking),
    topServices: [...serviceAgg.values()]
      .sort((a, b) => b.count - a.count || b.valueMinor - a.valueMinor)
      .slice(0, 10),
    services: [...serviceAgg.values()].sort((a, b) => b.valueMinor - a.valueMinor || b.count - a.count),
    clients: {
      seen: inRange.size,
      new: newClients,
      returning: inRange.size - newClients,
      retentionPct: {
        d30: pct(back[30], base[30]),
        d60: pct(back[60], base[60]),
        d90: pct(back[90], base[90]),
      },
    },
  };
}

export type Report = ReturnType<typeof computeReport>;
