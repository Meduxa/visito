import { describe, expect, it } from "vitest";
import { computePayroll, shiftMonth, splitDiscount, type PayrollInput } from "./compute";

const base: PayrollInput = {
  staff: [
    { id: "ana", name: "Ana", active: true, defaultPct: 30, salaryMinor: 50000 },
    { id: "gio", name: "Gio", active: true, defaultPct: 0, salaryMinor: 0 },
    { id: "old", name: "Old", active: false, defaultPct: 50, salaryMinor: 0 },
  ],
  items: [
    { staffId: "ana", serviceId: "cut", categoryId: "hair", valueMinor: 5000 },
    { staffId: "ana", serviceId: "color", categoryId: "hair", valueMinor: 12000 },
    { staffId: "ana", serviceId: "nails", categoryId: "nails", valueMinor: 3000 },
    { staffId: "gio", serviceId: "cut", categoryId: "hair", valueMinor: 5000 },
  ],
  tips: [{ staffId: "ana", tipMinor: 1000 }],
  rates: [
    { staffId: "ana", categoryId: "hair", serviceId: null, pct: 40 },
    { staffId: "ana", categoryId: null, serviceId: "color", pct: 50 },
  ],
  adjustments: [
    { id: "a1", staffId: "ana", kind: "bonus", amountMinor: 2000, note: null },
    { id: "a2", staffId: "ana", kind: "deduction", amountMinor: 500, note: "late" },
  ],
  payouts: [
    { id: "p1", staffId: "ana", amountMinor: 30000, method: "cash", paidOn: "2026-11-15", note: null },
  ],
};

describe("payroll", () => {
  it("service rate beats category rate beats the default %", () => {
    const ana = computePayroll(base).staff.find((s) => s.id === "ana")!;
    // color 120 × 50% = 60; cut 50 × 40% (hair) = 20; nails 30 × 30% (default) = 9
    expect(ana.commissionMinor).toBe(6000 + 2000 + 900);
    expect(ana.lines.map((l) => [l.source.kind, l.pct, l.valueMinor])).toEqual([
      ["service", 50, 12000],
      ["category", 40, 5000],
      ["default", 30, 3000],
    ]);
    expect(ana.servicesCount).toBe(3);
  });

  it("total = salary + commission + tips + bonus − deduction; balance after payouts", () => {
    const ana = computePayroll(base).staff.find((s) => s.id === "ana")!;
    expect(ana.totalMinor).toBe(50000 + 8900 + 1000 + 2000 - 500);
    expect(ana.paidMinor).toBe(30000);
    expect(ana.balanceMinor).toBe(61400 - 30000);
  });

  it("someone with 0% and no salary earns nothing; inactive people with nothing are left out", () => {
    const r = computePayroll(base);
    expect(r.staff.find((s) => s.id === "gio")!.totalMinor).toBe(0);
    expect(r.staff.some((s) => s.id === "old")).toBe(false);
    expect(r.totals.totalMinor).toBe(61400);
    expect(r.totals.balanceMinor).toBe(31400);
  });

  it("an advance (paid more than earned) does not lower what others are owed", () => {
    const r = computePayroll({
      ...base,
      payouts: [
        ...base.payouts,
        { id: "p2", staffId: "gio", amountMinor: 5000, method: "cash", paidOn: "2026-11-20", note: null },
      ],
    });
    expect(r.staff.find((s) => s.id === "gio")!.balanceMinor).toBe(-5000);
    expect(r.totals.balanceMinor).toBe(31400);
  });

  it("an inactive specialist with work this month still shows", () => {
    const r = computePayroll({
      ...base,
      items: [...base.items, { staffId: "old", serviceId: null, categoryId: null, valueMinor: 1000 }],
    });
    expect(r.staff.find((s) => s.id === "old")!.commissionMinor).toBe(500);
  });

  it("splits a discount over items exactly", () => {
    expect(splitDiscount([6000, 4000], 1000)).toEqual([5400, 3600]);
    const parts = splitDiscount([3333, 3333, 3334], 1001);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10000 - 1001);
    expect(splitDiscount([500, 500], 5000)).toEqual([0, 0]);
    expect(splitDiscount([0, 0], 100)).toEqual([0, 0]);
    expect(splitDiscount([700], 0)).toEqual([700]);
  });

  it("moves between months", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
