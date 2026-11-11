"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { openSupportView, savePlan, topUpSms, updateTenant } from "../actions";

const STATUSES = ["trial", "active", "past_due", "suspended", "cancelled"] as const;
const select = "h-11 w-full rounded-lg border bg-background px-3 md:h-9";

function useRun() {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast.success(t("saved"));
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

export function TenantPlanForm(props: {
  tenantId: string;
  plan: string;
  status: string;
  trialEndsAt: string; // yyyy-mm-dd
  plans: { code: string; name: string }[];
}) {
  const t = useTranslations("platform");
  const [v, setV] = useState({ plan: props.plan, status: props.status, trialEndsAt: props.trialEndsAt });
  const { pending, error, run } = useRun();
  return (
    <Card className="gap-4 p-4 md:p-6">
      <h2 className="text-base font-semibold">{t("planAndStatus")}</h2>
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="ta-plan" label={t("cols.plan")}>
          <select
            id="ta-plan"
            className={select}
            value={v.plan}
            onChange={(e) => setV({ ...v, plan: e.target.value })}
          >
            {props.plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="ta-status" label={t("cols.status")}>
          <select
            id="ta-status"
            className={select}
            value={v.status}
            onChange={(e) => setV({ ...v, status: e.target.value })}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id="ta-trial" label={t("trialEnds")}>
          <Input
            id="ta-trial"
            type="date"
            className="h-11 md:h-9"
            value={v.trialEndsAt}
            onChange={(e) => setV({ ...v, trialEndsAt: e.target.value })}
          />
        </FormField>
      </div>
      <p className="text-xs text-muted-foreground">{t("statusHint")}</p>
      <FieldError code={error} />
      <Button
        className="h-11 self-start md:h-9"
        disabled={pending}
        onClick={() => run(() => updateTenant({ tenantId: props.tenantId, ...v }))}
      >
        {t("save")}
      </Button>
    </Card>
  );
}

export function TopUpForm({ tenantId, balance }: { tenantId: string; balance: number }) {
  const t = useTranslations("platform");
  const [segments, setSegments] = useState("");
  const [note, setNote] = useState("");
  const { pending, error, run } = useRun();
  return (
    <Card className="gap-4 p-4 md:p-6">
      <h2 className="text-base font-semibold">{t("smsBalance", { count: balance })}</h2>
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <FormField id="tu-n" label={t("smsAdd")} hint={t("smsAddHint")}>
          <Input
            id="tu-n"
            inputMode="numeric"
            className="h-11 md:h-9"
            value={segments}
            onChange={(e) => setSegments(e.target.value)}
          />
        </FormField>
        <FormField id="tu-note" label={t("note")}>
          <Input
            id="tu-note"
            maxLength={200}
            className="h-11 md:h-9"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </FormField>
      </div>
      <FieldError code={error} />
      <Button
        className="h-11 self-start md:h-9"
        disabled={pending || !/^-?\d+$/.test(segments.trim()) || Number(segments) === 0}
        onClick={() =>
          run(
            () => topUpSms({ tenantId, segments: Number(segments), note }),
            () => {
              setSegments("");
              setNote("");
            },
          )
        }
      >
        {t("smsAddButton")}
      </Button>
    </Card>
  );
}

type Plan = {
  code: string;
  name: string;
  price: string;
  maxStaff: string;
  smsPerMonth: string;
  active: boolean;
  features: "payroll"[];
};

export function PlanEditor({ plan, isNew = false }: { plan: Plan; isNew?: boolean }) {
  const t = useTranslations("platform");
  const [v, setV] = useState(plan);
  const { pending, error, run } = useRun();
  const id = `plan-${isNew ? "new" : plan.code}`;
  return (
    <Card className="gap-3 p-4">
      <div className="grid gap-3 sm:grid-cols-6">
        <FormField id={`${id}-code`} label={t("plans.code")}>
          <Input
            id={`${id}-code`}
            disabled={!isNew}
            className="h-11 md:h-9"
            value={v.code}
            onChange={(e) => setV({ ...v, code: e.target.value.toLowerCase() })}
          />
        </FormField>
        <FormField id={`${id}-name`} label={t("plans.name")} className="sm:col-span-2">
          <Input
            id={`${id}-name`}
            className="h-11 md:h-9"
            value={v.name}
            onChange={(e) => setV({ ...v, name: e.target.value })}
          />
        </FormField>
        <FormField id={`${id}-price`} label={t("plans.price")}>
          <Input
            id={`${id}-price`}
            inputMode="decimal"
            className="h-11 md:h-9"
            value={v.price}
            onChange={(e) => setV({ ...v, price: e.target.value })}
          />
        </FormField>
        <FormField id={`${id}-staff`} label={t("plans.maxStaff")}>
          <Input
            id={`${id}-staff`}
            inputMode="numeric"
            placeholder="∞"
            className="h-11 md:h-9"
            value={v.maxStaff}
            onChange={(e) => setV({ ...v, maxStaff: e.target.value })}
          />
        </FormField>
        <FormField id={`${id}-sms`} label={t("plans.sms")}>
          <Input
            id={`${id}-sms`}
            inputMode="numeric"
            className="h-11 md:h-9"
            value={v.smsPerMonth}
            onChange={(e) => setV({ ...v, smsPerMonth: e.target.value })}
          />
        </FormField>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.active}
            onChange={(e) => setV({ ...v, active: e.target.checked })}
            className="size-4"
          />
          {t("plans.active")}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={v.features.includes("payroll")}
            onChange={(e) =>
              setV({
                ...v,
                features: e.target.checked
                  ? [...v.features, "payroll"]
                  : v.features.filter((f) => f !== "payroll"),
              })
            }
            className="size-4"
          />
          {t("plans.features.payroll")}
        </label>
        <FieldError code={error} />
        <Button
          size="sm"
          className="ml-auto h-11 md:h-8"
          disabled={pending || !v.code || !v.name.trim()}
          onClick={() => run(() => savePlan(v))}
        >
          {isNew ? t("plans.add") : t("save")}
        </Button>
      </div>
    </Card>
  );
}

// Support view: only while the owner allows it; the visit is written to their audit log.
export function SupportViewButton({ tenantId, until }: { tenantId: string; until: string | null }) {
  const t = useTranslations("supportAccess");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <Card className="gap-3 p-4 md:p-6">
      <h2 className="text-base font-semibold">{t("adminTitle")}</h2>
      <p className="text-sm text-muted-foreground">{until ? t("adminOn", { until }) : t("adminOff")}</p>
      <FieldError code={error} />
      {until && (
        <Button
          className="h-11 self-start md:h-9"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await openSupportView(tenantId);
              if (!r.ok) setError(r.error);
            })
          }
        >
          {t("open")}
        </Button>
      )}
    </Card>
  );
}
