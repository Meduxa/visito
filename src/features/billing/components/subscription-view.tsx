"use client";

import { BadgeCheck, CreditCard, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { cn } from "@/lib/utils";
import { startPayment, stopAutopay } from "../actions";
import type { BillingPage } from "../queries";

const PAY_TONE = {
  approved: "success",
  processing: "warning",
  declined: "danger",
  expired: "neutral",
  reversed: "neutral",
  mismatch: "danger",
  created: "neutral",
} as const;

export function SubscriptionView({ data, returned }: { data: BillingPage; returned: string | null }) {
  const t = useTranslations("billing");
  const { dayShort } = useDates();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  const pay = (kind: "plan", code: string) =>
    start(async () => {
      setError(undefined);
      setBusy(`${kind}:${code}`);
      const r = await startPayment(kind, code);
      if (!r.ok) {
        setBusy(null);
        return setError(r.error);
      }
      window.location.assign(r.data.url); // Flitt's own card page
    });

  const statusText =
    data.status === "trial"
      ? t("statusTrial", { date: dayShort(data.trialEndsAt.slice(0, 10)) })
      : data.paidUntil
        ? data.autopay
          ? t("statusPaidAuto", { date: dayShort(data.paidUntil.slice(0, 10)) })
          : t("statusPaidUntil", { date: dayShort(data.paidUntil.slice(0, 10)) })
        : t(`status.${data.status as "active"}`);

  return (
    <div className="flex flex-col gap-5">
      {returned && (
        <p
          role="status"
          className={cn(
            "rounded-lg p-3 text-sm",
            returned === "approved" ? "bg-success-soft text-success-ink" : "bg-warning-soft text-warning-ink",
          )}
        >
          {t(
            `returned.${["approved", "declined", "expired"].includes(returned) ? (returned as "approved") : "processing"}`,
          )}
        </p>
      )}

      <Card className="gap-2 p-4">
        <p className="text-sm text-muted-foreground">{t("current")}</p>
        <p className="text-xl font-semibold">
          {data.plan?.code === "trial" || !data.plan ? t("trial") : data.plan.name}
        </p>
        <p className="text-sm">{statusText}</p>
        <p className="text-sm text-muted-foreground">{t("smsLeft", { count: data.smsBalance })}</p>
        {data.autopay && (
          <ConfirmDialog
            description={t("stopConfirm")}
            onConfirm={() =>
              start(async () => {
                const r = await stopAutopay();
                if (!r.ok) return setError(r.error);
                toast.success(t("stopped"));
                router.refresh();
              })
            }
            trigger={
              <Button variant="outline" className="h-11 self-start md:h-9" disabled={pending}>
                {t("stop")}
              </Button>
            }
          />
        )}
      </Card>

      {!data.cardPayments && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">{t("cardOff")}</p>
      )}
      <FieldError code={error} />

      <section aria-labelledby="plans-h" className="flex flex-col gap-3">
        <h2 id="plans-h" className="text-base font-semibold">
          {t("plansTitle")}
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {data.plans.map((p) => {
            const isCurrent = data.plan?.code === p.code && data.status === "active";
            return (
              <li key={p.code}>
                <Card className={cn("h-full gap-3 p-4", isCurrent && "border-primary")}>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-lg font-semibold">{p.name}</h3>
                    {isCurrent && <StatusPill tone="success">{t("yourPlan")}</StatusPill>}
                  </div>
                  <p className="text-2xl font-bold">
                    {formatMoney(p.priceMinor)}
                    <span className="text-sm font-normal text-muted-foreground"> {t("perMonth")}</span>
                  </p>
                  <ul className="flex flex-1 flex-col gap-1 text-sm">
                    <li className="flex gap-2">
                      <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden />
                      {p.maxStaff === null ? t("staffUnlimited") : t("staffUpTo", { count: p.maxStaff })}
                    </li>
                    <li className="flex gap-2">
                      <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden />
                      {t("smsPerMonth", { count: p.smsPerMonth })}
                    </li>
                    {p.payroll && (
                      <li className="flex gap-2">
                        <BadgeCheck className="size-4 shrink-0 text-primary" aria-hidden />
                        {t("payroll")}
                      </li>
                    )}
                  </ul>
                  <Button
                    className="h-11 md:h-10"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={!data.cardPayments || pending || (isCurrent && data.autopay)}
                    onClick={() => pay("plan", p.code)}
                  >
                    <CreditCard aria-hidden />
                    {busy === `plan:${p.code}`
                      ? t("opening")
                      : isCurrent && data.autopay
                        ? t("paysAutomatically")
                        : t("payMonthly", { price: formatMoney(p.priceMinor) })}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("cardNote")}
        </p>
      </section>

      {/* SMS packs: not offered yet (Levan, 2026-11-12) — the database is ready (decision 031) */}

      <section aria-labelledby="hist-h" className="flex flex-col gap-2">
        <h2 id="hist-h" className="text-base font-semibold">
          {t("historyTitle")}
        </h2>
        {data.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>
        ) : (
          <Card className="gap-0 p-0">
            <ul className="divide-y text-sm">
              {data.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="w-20 tabular-nums">
                    {dayShort((p.paidAt ?? p.createdAt).slice(0, 10))}
                  </span>
                  <span className="flex-1">
                    {p.name}
                    {p.card && <span className="ml-2 text-xs text-muted-foreground">{p.card}</span>}
                  </span>
                  <span className="tabular-nums">{formatMoney(p.amountMinor)}</span>
                  <StatusPill tone={PAY_TONE[p.status as keyof typeof PAY_TONE] ?? "neutral"}>
                    {t(`payStatus.${p.status as "approved"}`)}
                  </StatusPill>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
