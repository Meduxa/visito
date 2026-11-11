"use client";

import { ChevronRight, Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailPanel } from "@/components/detail-panel";
import { EmptyState } from "@/components/empty-state";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { formatMoney } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { cn } from "@/lib/utils";
import { addAdjustment, addPayout, removeAdjustment, removePayout } from "../actions";
import type { PayrollRow } from "../compute";
import { payoutMethods } from "../schema";

type Row = Omit<PayrollRow, "lines"> & { lines: (PayrollRow["lines"][number] & { label: string | null })[] };

function useRun() {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ code: string; field?: string }>();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError({ code: r.error, field: r.field });
      toast.success(t("saved"));
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

const money = (minor: number) => formatMoney(minor);

export function PayrollView({
  month,
  today,
  rows,
  readOnly,
}: {
  month: string;
  today: string;
  rows: Row[];
  readOnly: boolean;
}) {
  const t = useTranslations("payroll");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((r) => r.id === openId) ?? null;

  if (rows.length === 0)
    return (
      <EmptyState
        icon={<UserRound />}
        title={t("empty")}
        description={t("emptyHint")}
        action={
          <Button asChild className="h-11 md:h-9">
            <Link href="/staff">{t("goToStaff")}</Link>
          </Button>
        }
      />
    );

  return (
    <>
      <Card className="gap-0 overflow-hidden p-0">
        <div
          className="hidden grid-cols-[minmax(10rem,1.4fr)_repeat(6,minmax(0,1fr))_1.5rem] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid"
          aria-hidden
        >
          <span>{t("cols.staff")}</span>
          <span className="text-right">{t("cols.services")}</span>
          <span className="text-right">{t("cols.commission")}</span>
          <span className="text-right">{t("cols.salary")}</span>
          <span className="text-right">{t("cols.extras")}</span>
          <span className="text-right">{t("cols.total")}</span>
          <span className="text-right">{t("cols.owed")}</span>
          <span />
        </div>
        <ul className="divide-y">
          {rows.map((r) => {
            const extras = r.tipsMinor + r.bonusMinor - r.deductionMinor;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(r.id)}
                  className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left text-sm outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 lg:grid-cols-[minmax(10rem,1.4fr)_repeat(6,minmax(0,1fr))_1.5rem]"
                >
                  <span className="font-medium">
                    {r.name}
                    {!r.active && <span className="ml-2 text-xs text-muted-foreground">{t("inactive")}</span>}
                  </span>
                  {/* phone: one line under the name */}
                  <span className="row-span-2 text-right lg:hidden">
                    <span className="block font-semibold tabular-nums">{money(r.totalMinor)}</span>
                    <span
                      className={cn(
                        "block text-xs tabular-nums",
                        r.balanceMinor > 0 ? "text-warning-ink" : "text-muted-foreground",
                      )}
                    >
                      {r.balanceMinor > 0 ? t("owedShort", { amount: money(r.balanceMinor) }) : t("settled")}
                    </span>
                  </span>
                  <span className="text-xs text-muted-foreground lg:hidden">
                    {t("mobileLine", {
                      count: r.servicesCount,
                      commission: money(r.commissionMinor),
                      salary: money(r.salaryMinor),
                    })}
                  </span>
                  <span className="hidden text-right tabular-nums lg:block">
                    {money(r.servicesMinor)}
                    <span className="block text-xs text-muted-foreground">
                      {t("visits", { count: r.servicesCount })}
                    </span>
                  </span>
                  <span className="hidden text-right tabular-nums lg:block">{money(r.commissionMinor)}</span>
                  <span className="hidden text-right tabular-nums lg:block">{money(r.salaryMinor)}</span>
                  <span className="hidden text-right tabular-nums lg:block">{money(extras)}</span>
                  <span className="hidden text-right font-semibold tabular-nums lg:block">
                    {money(r.totalMinor)}
                  </span>
                  <span
                    className={cn(
                      "hidden text-right tabular-nums lg:block",
                      r.balanceMinor > 0 ? "font-medium text-warning-ink" : "text-muted-foreground",
                    )}
                  >
                    {money(r.balanceMinor)}
                  </span>
                  <ChevronRight className="hidden size-4 text-muted-foreground lg:block" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      {open && (
        <DetailPanel
          open
          onOpenChange={(o) => !o && setOpenId(null)}
          title={open.name}
          description={t("payslipFor")}
        >
          <Payslip row={open} month={month} today={today} readOnly={readOnly} />
        </DetailPanel>
      )}
    </>
  );
}

function Line({
  label,
  value,
  sub,
  strong,
}: {
  label: string;
  value: number;
  sub?: string;
  strong?: boolean;
}) {
  return (
    <div className={cn("flex items-baseline gap-3 py-1.5", strong && "font-semibold")}>
      <span className="flex-1">
        {label}
        {sub && <span className="block text-xs font-normal text-muted-foreground">{sub}</span>}
      </span>
      <span className="tabular-nums">{money(value)}</span>
    </div>
  );
}

function Payslip({
  row,
  month,
  today,
  readOnly,
}: {
  row: Row;
  month: string;
  today: string;
  readOnly: boolean;
}) {
  const t = useTranslations("payroll");
  const { dayShort } = useDates();
  const { run, pending } = useRun();

  return (
    <div className="flex flex-col gap-5 text-sm">
      <section aria-label={t("earned")} className="flex flex-col divide-y">
        <Line label={t("salary")} value={row.salaryMinor} />
        {row.lines.length === 0 ? (
          <Line label={t("cols.commission")} value={0} sub={t("noServices")} />
        ) : (
          row.lines.map((l) => (
            <Line
              key={l.source.kind === "default" ? "default" : l.source.id}
              label={t("commissionLine", { name: l.label ?? t("defaultRate"), pct: l.pct })}
              sub={t("commissionSub", { count: l.count, value: money(l.valueMinor) })}
              value={l.commissionMinor}
            />
          ))
        )}
        {row.tipsMinor > 0 && <Line label={t("tips")} value={row.tipsMinor} />}
        {row.adjustments.map((a) => (
          <div key={a.id} className="flex items-center gap-3 py-1.5">
            <span className="flex-1">
              {t(a.kind)}
              {a.note && <span className="block text-xs text-muted-foreground">{a.note}</span>}
            </span>
            <span className={cn("tabular-nums", a.kind === "deduction" && "text-destructive-ink")}>
              {a.kind === "deduction" ? "−" : "+"}
              {money(a.amountMinor)}
            </span>
            {!readOnly && (
              <ConfirmDialog
                description={t("removeAdjustment")}
                onConfirm={() => run(() => removeAdjustment(a.id))}
                trigger={
                  <Button variant="ghost" size="icon" className="size-11 md:size-8" aria-label={t("remove")}>
                    <Trash2 aria-hidden />
                  </Button>
                }
              />
            )}
          </div>
        ))}
        <Line label={t("cols.total")} value={row.totalMinor} strong />
      </section>

      <section aria-label={t("payouts")} className="flex flex-col gap-1">
        <h3 className="font-semibold">{t("payouts")}</h3>
        {row.payouts.length === 0 ? (
          <p className="text-muted-foreground">{t("noPayouts")}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {row.payouts.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-1.5">
                <span className="flex-1">
                  {dayShort(p.paidOn)} · {t(`methods.${p.method as "cash"}`)}
                  {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
                </span>
                <span className="tabular-nums">{money(p.amountMinor)}</span>
                {!readOnly && (
                  <ConfirmDialog
                    description={t("removePayout")}
                    onConfirm={() => run(() => removePayout(p.id))}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 md:size-8"
                        aria-label={t("remove")}
                        disabled={pending}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    }
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        <div
          className={cn(
            "mt-1 flex items-baseline gap-3 rounded-lg px-3 py-2 font-semibold",
            row.balanceMinor > 0 ? "bg-warning-soft text-warning-ink" : "bg-muted",
          )}
        >
          <span className="flex-1">{row.balanceMinor >= 0 ? t("cols.owed") : t("overpaid")}</span>
          <span className="tabular-nums">{money(Math.abs(row.balanceMinor))}</span>
        </div>
      </section>

      {!readOnly && (
        <>
          <PayoutForm row={row} month={month} today={today} />
          <AdjustmentForm staffId={row.id} month={month} />
        </>
      )}
    </div>
  );
}

const toInput = (minor: number) =>
  minor > 0 ? (minor / 100).toFixed(minor % 100 ? 2 : 0).replace(".", ",") : "";

function PayoutForm({ row, month, today }: { row: Row; month: string; today: string }) {
  const t = useTranslations("payroll");
  const { run, pending, error } = useRun();
  const fresh = () => ({
    amount: toInput(row.balanceMinor),
    method: "cash" as const,
    paidOn: today,
    note: "",
  });
  const [v, setV] = useState<{
    amount: string;
    method: (typeof payoutMethods)[number];
    paidOn: string;
    note: string;
  }>(fresh);
  const id = `payout-${row.id}`;
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addPayout({ staffId: row.id, month, ...v }),
          () => setV({ ...fresh(), amount: "" }),
        );
      }}
    >
      <h3 className="font-semibold">{t("recordPayout")}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField
          id={`${id}-amount`}
          label={t("amount")}
          error={error?.field === "amount" ? error.code : undefined}
        >
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            className="h-11 md:h-9"
            value={v.amount}
            onChange={(e) => setV({ ...v, amount: e.target.value })}
          />
        </FormField>
        <FormField id={`${id}-method`} label={t("method")}>
          <Select value={v.method} onValueChange={(m) => setV({ ...v, method: m as "cash" })}>
            <SelectTrigger id={`${id}-method`} className="h-11 w-full md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {payoutMethods.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`methods.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField id={`${id}-date`} label={t("paidOn")}>
          <Input
            id={`${id}-date`}
            type="date"
            className="h-11 md:h-9"
            value={v.paidOn}
            onChange={(e) => setV({ ...v, paidOn: e.target.value })}
          />
        </FormField>
      </div>
      <FormField id={`${id}-note`} label={t("note")}>
        <Input
          id={`${id}-note`}
          maxLength={200}
          className="h-11 md:h-9"
          value={v.note}
          onChange={(e) => setV({ ...v, note: e.target.value })}
        />
      </FormField>
      {error && !error.field && <FieldError code={error.code} />}
      <Button type="submit" className="h-11 self-start md:h-9" disabled={pending || !v.amount}>
        {t("recordPayout")}
      </Button>
    </form>
  );
}

function AdjustmentForm({ staffId, month }: { staffId: string; month: string }) {
  const t = useTranslations("payroll");
  const { run, pending, error } = useRun();
  const empty = { kind: "bonus" as "bonus" | "deduction", amount: "", note: "" };
  const [v, setV] = useState(empty);
  const id = `adj-${staffId}`;
  return (
    <form
      className="flex flex-col gap-3 rounded-xl border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => addAdjustment({ staffId, month, ...v }),
          () => setV(empty),
        );
      }}
    >
      <h3 className="font-semibold">{t("addAdjustment")}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id={`${id}-kind`} label={t("kind")}>
          <Select value={v.kind} onValueChange={(k) => setV({ ...v, kind: k as "bonus" })}>
            <SelectTrigger id={`${id}-kind`} className="h-11 w-full md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bonus">{t("bonus")}</SelectItem>
              <SelectItem value="deduction">{t("deduction")}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          id={`${id}-amount`}
          label={t("amount")}
          error={error?.field === "amount" ? error.code : undefined}
        >
          <Input
            id={`${id}-amount`}
            inputMode="decimal"
            className="h-11 md:h-9"
            value={v.amount}
            onChange={(e) => setV({ ...v, amount: e.target.value })}
          />
        </FormField>
        <FormField id={`${id}-note`} label={t("note")}>
          <Input
            id={`${id}-note`}
            maxLength={200}
            placeholder={t("notePlaceholder")}
            className="h-11 md:h-9"
            value={v.note}
            onChange={(e) => setV({ ...v, note: e.target.value })}
          />
        </FormField>
      </div>
      {error && !error.field && <FieldError code={error.code} />}
      <Button
        type="submit"
        variant="outline"
        className="h-11 self-start md:h-9"
        disabled={pending || !v.amount}
      >
        {t("add")}
      </Button>
    </form>
  );
}
