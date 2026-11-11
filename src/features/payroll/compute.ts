// Payroll for one month, from raw rows. Pure: the loader (payroll.ts) fetches,
// this counts. Money is integer tetri throughout (decision 025).
//
// Earned = fixed salary + % of completed services + tips + bonuses − deductions.
// The % of a service: the specialist's rate for that service, else for its
// category, else their default % (staff.commission_pct).

export type PayItem = {
  staffId: string;
  serviceId: string | null;
  categoryId: string | null;
  /** service price after this item's share of the booking discount */
  valueMinor: number;
};
export type PayStaff = { id: string; name: string; active: boolean; defaultPct: number; salaryMinor: number };
export type PayRate = { staffId: string; categoryId: string | null; serviceId: string | null; pct: number };
export type PayAdjustment = {
  id: string;
  staffId: string;
  kind: "bonus" | "deduction";
  amountMinor: number;
  note: string | null;
};
export type Payout = {
  id: string;
  staffId: string;
  amountMinor: number;
  method: string;
  paidOn: string;
  note: string | null;
};

export type PayrollInput = {
  staff: PayStaff[];
  items: PayItem[];
  tips: { staffId: string; tipMinor: number }[];
  rates: PayRate[];
  adjustments: PayAdjustment[];
  payouts: Payout[];
};

export type RateSource =
  { kind: "service"; id: string } | { kind: "category"; id: string } | { kind: "default" };

export type PayLine = {
  source: RateSource;
  pct: number;
  count: number;
  valueMinor: number;
  commissionMinor: number;
};

/**
 * Splits a booking discount over its items in proportion to their prices, so a
 * 10 ₾ discount on 60 + 40 ₾ takes 6 + 4 ₾. The shares always add up exactly
 * (largest remainder), and no item goes below zero.
 */
export function splitDiscount(prices: number[], discountMinor: number): number[] {
  const total = prices.reduce((a, p) => a + p, 0);
  const discount = Math.min(Math.max(discountMinor, 0), total);
  if (total === 0 || discount === 0) return [...prices];
  const exact = prices.map((p) => (p * discount) / total);
  const shares = exact.map(Math.floor);
  let left = discount - shares.reduce((a, s) => a + s, 0);
  const order = exact.map((e, i) => [e - Math.floor(e), i] as const).sort((x, y) => y[0] - x[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return prices.map((p, i) => p - shares[i]);
}

export function computePayroll(r: PayrollInput) {
  const rateOf = (staffId: string, serviceId: string | null, categoryId: string | null, fallback: number) => {
    const mine = r.rates.filter((x) => x.staffId === staffId);
    const byService = serviceId ? mine.find((x) => x.serviceId === serviceId) : undefined;
    if (byService) return { source: { kind: "service", id: serviceId! } as RateSource, pct: byService.pct };
    const byCategory = categoryId ? mine.find((x) => x.categoryId === categoryId) : undefined;
    if (byCategory)
      return { source: { kind: "category", id: categoryId! } as RateSource, pct: byCategory.pct };
    return { source: { kind: "default" } as RateSource, pct: fallback };
  };
  const key = (s: RateSource) => (s.kind === "default" ? "default" : `${s.kind}:${s.id}`);

  const rows = r.staff.map((s) => {
    const lines = new Map<string, PayLine>();
    for (const i of r.items.filter((x) => x.staffId === s.id)) {
      const { source, pct } = rateOf(s.id, i.serviceId, i.categoryId, s.defaultPct);
      const line = lines.get(key(source)) ?? { source, pct, count: 0, valueMinor: 0, commissionMinor: 0 };
      line.count += 1;
      line.valueMinor += i.valueMinor;
      lines.set(key(source), line);
    }
    const payLines = [...lines.values()]
      .map((l) => ({ ...l, commissionMinor: Math.round((l.valueMinor * l.pct) / 100) }))
      .sort((a, b) => b.valueMinor - a.valueMinor);
    const servicesMinor = payLines.reduce((a, l) => a + l.valueMinor, 0);
    const commissionMinor = payLines.reduce((a, l) => a + l.commissionMinor, 0);
    const tipsMinor = r.tips.filter((t) => t.staffId === s.id).reduce((a, t) => a + t.tipMinor, 0);
    const adjustments = r.adjustments.filter((a) => a.staffId === s.id);
    const bonusMinor = adjustments.filter((a) => a.kind === "bonus").reduce((a, x) => a + x.amountMinor, 0);
    const deductionMinor = adjustments
      .filter((a) => a.kind === "deduction")
      .reduce((a, x) => a + x.amountMinor, 0);
    const payouts = r.payouts
      .filter((p) => p.staffId === s.id)
      .sort((a, b) => a.paidOn.localeCompare(b.paidOn));
    const paidMinor = payouts.reduce((a, p) => a + p.amountMinor, 0);
    const totalMinor = s.salaryMinor + commissionMinor + tipsMinor + bonusMinor - deductionMinor;
    return {
      id: s.id,
      name: s.name,
      active: s.active,
      defaultPct: s.defaultPct,
      salaryMinor: s.salaryMinor,
      lines: payLines,
      servicesCount: payLines.reduce((a, l) => a + l.count, 0),
      servicesMinor,
      commissionMinor,
      tipsMinor,
      bonusMinor,
      deductionMinor,
      adjustments,
      payouts,
      totalMinor,
      paidMinor,
      balanceMinor: totalMinor - paidMinor,
    };
  });

  // inactive specialists only when something happened for them this month
  const shown = rows.filter(
    (s) =>
      s.active || s.servicesCount > 0 || s.tipsMinor > 0 || s.adjustments.length > 0 || s.payouts.length > 0,
  );
  const sum = (f: (s: (typeof rows)[number]) => number) => shown.reduce((a, s) => a + f(s), 0);
  return {
    staff: shown,
    totals: {
      totalMinor: sum((s) => s.totalMinor),
      paidMinor: sum((s) => s.paidMinor),
      // what is still owed; someone paid ahead (an advance) does not lower what others are owed
      balanceMinor: sum((s) => Math.max(0, s.balanceMinor)),
      servicesMinor: sum((s) => s.servicesMinor),
    },
  };
}

export type Payroll = ReturnType<typeof computePayroll>;
export type PayrollRow = Payroll["staff"][number];

/** "2026-11" → previous / next month. */
export function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
}
