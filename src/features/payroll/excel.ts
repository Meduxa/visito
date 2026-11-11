import "server-only";
import writeXlsxFile from "write-excel-file/node";
import { excelSafe } from "@/lib/excel-safe";
import type { LoadedPayroll } from "./payroll";

type Cell = {
  value: string | number | null;
  fontWeight?: "bold";
  format?: string;
  type?: NumberConstructor | StringConstructor;
} | null;
type T = (key: string, values?: Record<string, string | number>) => string;

const head = (...labels: string[]): Cell[] => labels.map((value) => ({ value, fontWeight: "bold" }));
const gel = (minor: number): Cell => ({ value: minor / 100, type: Number, format: "#,##0.00" });
const num = (n: number): Cell => ({ value: n, type: Number });
const text = (s: string): Cell => ({ value: excelSafe(s), type: String });

/** Summary sheet (one row per specialist) + a detail sheet (every pay line, bonus, payout). */
export async function payrollWorkbook(p: LoadedPayroll, opts: { t: T; month: string }) {
  const L = (k: string, v?: Record<string, string | number>) => opts.t(`payroll.${k}`, v);
  const summary: Cell[][] = [
    head(L("excel.month"), opts.month),
    [],
    head(
      L("cols.staff"),
      L("cols.visitsCount"),
      L("cols.services"),
      L("cols.commission"),
      L("salary"),
      L("tips"),
      L("bonus"),
      L("deduction"),
      L("cols.total"),
      L("paid"),
      L("cols.owed"),
    ),
    ...p.staff.map((s) => [
      text(s.name),
      num(s.servicesCount),
      gel(s.servicesMinor),
      gel(s.commissionMinor),
      gel(s.salaryMinor),
      gel(s.tipsMinor),
      gel(s.bonusMinor),
      gel(s.deductionMinor),
      gel(s.totalMinor),
      gel(s.paidMinor),
      gel(s.balanceMinor),
    ]),
    [
      { value: L("excel.total"), fontWeight: "bold" },
      null,
      gel(p.totals.servicesMinor),
      null,
      null,
      null,
      null,
      null,
      gel(p.totals.totalMinor),
      gel(p.totals.paidMinor),
      gel(p.totals.balanceMinor),
    ],
  ];
  const detail: Cell[][] = [head(L("cols.staff"), L("excel.item"), L("excel.base"), L("pct"), L("amount"))];
  for (const s of p.staff) {
    if (s.salaryMinor) detail.push([text(s.name), text(L("salary")), null, null, gel(s.salaryMinor)]);
    for (const l of s.lines)
      detail.push([
        text(s.name),
        text(L("commissionLine", { name: l.label ?? L("defaultRate"), pct: l.pct })),
        gel(l.valueMinor),
        num(l.pct),
        gel(l.commissionMinor),
      ]);
    if (s.tipsMinor) detail.push([text(s.name), text(L("tips")), null, null, gel(s.tipsMinor)]);
    for (const a of s.adjustments)
      detail.push([
        text(s.name),
        text([L(a.kind), a.note].filter(Boolean).join(": ")),
        null,
        null,
        gel(a.kind === "deduction" ? -a.amountMinor : a.amountMinor),
      ]);
    for (const x of s.payouts)
      detail.push([
        text(s.name),
        text([`${L("paid")} ${x.paidOn}`, L(`methods.${x.method}`), x.note].filter(Boolean).join(" · ")),
        null,
        null,
        gel(-x.amountMinor),
      ]);
  }
  return (await writeXlsxFile([summary, detail], {
    sheets: [L("excel.summary"), L("excel.detail")].map((s) => s.slice(0, 31)),
    buffer: true,
  } as never)) as unknown as Buffer;
}
