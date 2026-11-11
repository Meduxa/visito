"use client";

import { Trash2, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { addPayRate, removePayRate, savePayScheme } from "../actions";
import type { PaySettings } from "../payroll";

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

const toInput = (minor: number) =>
  minor > 0 ? (minor / 100).toFixed(minor % 100 ? 2 : 0).replace(".", ",") : "";

export function PaySettingsView({ data, readOnly }: { data: PaySettings; readOnly: boolean }) {
  const t = useTranslations("payroll");
  if (data.staff.length === 0)
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
    <div className="flex flex-col gap-4">
      {data.staff.map((s) => (
        <StaffPayCard key={s.id} staff={s} data={data} readOnly={readOnly} />
      ))}
    </div>
  );
}

function StaffPayCard({
  staff,
  data,
  readOnly,
}: {
  staff: PaySettings["staff"][number];
  data: PaySettings;
  readOnly: boolean;
}) {
  const t = useTranslations("payroll");
  const save = useRun();
  const add = useRun();
  const [v, setV] = useState({ salary: toInput(staff.salaryMinor), defaultPct: String(staff.defaultPct) });
  const [rate, setRate] = useState({ key: "", pct: "" });
  const id = `pay-${staff.id}`;
  const serviceName = new Map(data.services.map((s) => [s.id, s.name]));
  const categoryName = new Map(data.categories.map((c) => [c.id, c.name]));
  const taken = new Set(
    staff.rates.map((r) => (r.serviceId ? `service:${r.serviceId}` : `category:${r.categoryId}`)),
  );
  const [target, targetId] = rate.key.split(":") as ["category" | "service", string];

  return (
    <Card className="gap-4 p-4">
      <h2 className="text-base font-semibold">
        {staff.name}
        {!staff.active && (
          <span className="ml-2 text-xs font-normal text-muted-foreground">{t("inactive")}</span>
        )}
      </h2>
      <form
        className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          save.run(() => savePayScheme(staff.id, v));
        }}
      >
        <FormField
          id={`${id}-salary`}
          label={t("salaryMonthly")}
          hint={t("salaryHint")}
          error={save.error?.field === "salary" ? save.error.code : undefined}
        >
          <Input
            id={`${id}-salary`}
            inputMode="decimal"
            placeholder="0"
            disabled={readOnly}
            className="h-11 md:h-9"
            value={v.salary}
            onChange={(e) => setV({ ...v, salary: e.target.value })}
          />
        </FormField>
        <FormField id={`${id}-pct`} label={t("defaultPct")} hint={t("defaultPctHint")}>
          <Input
            id={`${id}-pct`}
            inputMode="decimal"
            disabled={readOnly}
            className="h-11 md:h-9"
            value={v.defaultPct}
            onChange={(e) => setV({ ...v, defaultPct: e.target.value })}
          />
        </FormField>
        {!readOnly && (
          <Button type="submit" className="h-11 md:h-9" disabled={save.pending}>
            {t("save")}
          </Button>
        )}
        {save.error && !save.error.field && <FieldError code={save.error.code} />}
      </form>

      <section aria-label={t("ratesTitle")} className="flex flex-col gap-2 border-t pt-3">
        <h3 className="text-sm font-semibold">{t("ratesTitle")}</h3>
        <p className="text-xs text-muted-foreground">{t("ratesHint")}</p>
        {staff.rates.length > 0 && (
          <ul className="flex flex-col divide-y text-sm">
            {staff.rates.map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-1.5">
                <span className="flex-1">
                  {r.serviceId ? serviceName.get(r.serviceId) : categoryName.get(r.categoryId!)}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.serviceId ? t("service") : t("category")}
                  </span>
                </span>
                <span className="tabular-nums">{r.pct}%</span>
                {!readOnly && (
                  <ConfirmDialog
                    description={t("removeRate")}
                    onConfirm={() => add.run(() => removePayRate(r.id))}
                    trigger={
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-11 md:size-8"
                        aria-label={t("remove")}
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
        {!readOnly && (
          <form
            className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto]"
            onSubmit={(e) => {
              e.preventDefault();
              add.run(
                () => addPayRate(staff.id, { target, targetId, pct: rate.pct }),
                () => setRate({ key: "", pct: "" }),
              );
            }}
          >
            <FormField id={`${id}-target`} label={t("rateFor")}>
              <Select value={rate.key} onValueChange={(k) => setRate({ ...rate, key: k })}>
                <SelectTrigger id={`${id}-target`} className="h-11 w-full md:h-9">
                  <SelectValue placeholder={t("rateForPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {data.categories.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>{t("categories")}</SelectLabel>
                      {data.categories
                        .filter((c) => !taken.has(`category:${c.id}`))
                        .map((c) => (
                          <SelectItem key={c.id} value={`category:${c.id}`}>
                            {c.name}
                          </SelectItem>
                        ))}
                    </SelectGroup>
                  )}
                  <SelectGroup>
                    <SelectLabel>{t("services")}</SelectLabel>
                    {data.services
                      .filter((s) => !taken.has(`service:${s.id}`))
                      .map((s) => (
                        <SelectItem key={s.id} value={`service:${s.id}`}>
                          {s.name}
                        </SelectItem>
                      ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>
            <FormField id={`${id}-rate`} label={t("pct")}>
              <Input
                id={`${id}-rate`}
                inputMode="decimal"
                className="h-11 md:h-9"
                value={rate.pct}
                onChange={(e) => setRate({ ...rate, pct: e.target.value })}
              />
            </FormField>
            <Button
              type="submit"
              variant="outline"
              className="h-11 md:h-9"
              disabled={add.pending || !rate.key || rate.pct === ""}
            >
              {t("add")}
            </Button>
            {add.error && <FieldError code={add.error.code} />}
          </form>
        )}
      </section>
    </Card>
  );
}
