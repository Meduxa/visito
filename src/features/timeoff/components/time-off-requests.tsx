"use client";

import { CalendarOff, Check, TriangleAlert, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import type { ActionResult } from "@/lib/action-result";
import { useDates } from "@/lib/use-dates";
import { cancelTimeOffRequest, decideTimeOff, requestTimeOff } from "../actions";
import type { TimeOffRequest } from "../queries";

const TONE = { pending: "warning", approved: "success", declined: "danger", cancelled: "neutral" } as const;

function useRun() {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const run = (fn: () => Promise<ActionResult>, after?: () => void) =>
    start(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      toast.success(t("saved"));
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

function Period({ r }: { r: TimeOffRequest }) {
  const { dayShort } = useDates();
  return <>{r.from === r.to ? dayShort(r.from) : `${dayShort(r.from)} – ${dayShort(r.to)}`}</>;
}

/** "My day": ask for time off and see what happened to earlier requests. */
export function MyTimeOff({ requests, today }: { requests: TimeOffRequest[]; today: string }) {
  const t = useTranslations("timeOffRequests");
  const reasons = useTranslations("staff.reasons");
  const { run, pending, error } = useRun();
  const [open, setOpen] = useState(false);
  const empty = { from: today, to: today, reason: "vacation" as const, note: "" };
  const [v, setV] = useState<{
    from: string;
    to: string;
    reason: "vacation" | "sick" | "other";
    note: string;
  }>(empty);
  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex-1 text-base font-semibold">{t("mineTitle")}</h2>
        {!open && (
          <Button variant="outline" className="h-11 md:h-9" onClick={() => setOpen(true)}>
            <CalendarOff aria-hidden />
            {t("ask")}
          </Button>
        )}
      </div>
      {open && (
        <form
          className="flex flex-col gap-3 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(
              () => requestTimeOff(v),
              () => {
                setOpen(false);
                setV(empty);
              },
            );
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <FormField id="to-from" label={t("from")}>
              <Input
                id="to-from"
                type="date"
                min={today}
                className="h-11 md:h-9"
                value={v.from}
                onChange={(e) =>
                  setV({ ...v, from: e.target.value, to: v.to < e.target.value ? e.target.value : v.to })
                }
              />
            </FormField>
            <FormField id="to-to" label={t("to")}>
              <Input
                id="to-to"
                type="date"
                min={v.from}
                className="h-11 md:h-9"
                value={v.to}
                onChange={(e) => setV({ ...v, to: e.target.value })}
              />
            </FormField>
            <FormField id="to-reason" label={t("reason")}>
              <Select value={v.reason} onValueChange={(r) => setV({ ...v, reason: r as "vacation" })}>
                <SelectTrigger id="to-reason" className="h-11 w-full md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["vacation", "sick", "other"] as const).map((r) => (
                    <SelectItem key={r} value={r}>
                      {reasons(r)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField id="to-note" label={t("note")}>
            <Input
              id="to-note"
              maxLength={300}
              className="h-11 md:h-9"
              value={v.note}
              onChange={(e) => setV({ ...v, note: e.target.value })}
            />
          </FormField>
          <FieldError code={error} />
          <div className="flex gap-2">
            <Button type="submit" className="h-11 md:h-9" disabled={pending}>
              {t("send")}
            </Button>
            <Button type="button" variant="ghost" className="h-11 md:h-9" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
      {requests.length === 0 ? (
        !open && <p className="text-sm text-muted-foreground">{t("mineEmpty")}</p>
      ) : (
        <ul className="flex flex-col divide-y text-sm">
          {requests.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="flex-1">
                <Period r={r} /> · {reasons(r.reason)}
                {r.decisionNote && (
                  <span className="block text-xs text-muted-foreground">{r.decisionNote}</span>
                )}
              </span>
              <StatusPill tone={TONE[r.status]}>{t(`status.${r.status}`)}</StatusPill>
              {r.status === "pending" && (
                <ConfirmDialog
                  description={t("withdrawConfirm")}
                  onConfirm={() => run(() => cancelTimeOffRequest(r.id))}
                  trigger={
                    <Button variant="ghost" className="h-11 md:h-8">
                      {t("withdraw")}
                    </Button>
                  }
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** Staff page (owner/admin): requests waiting for a decision, and recent decisions. */
export function TimeOffInbox({ requests }: { requests: TimeOffRequest[] }) {
  const t = useTranslations("timeOffRequests");
  const reasons = useTranslations("staff.reasons");
  const { run, pending, error } = useRun();
  const open = requests.filter((r) => r.status === "pending");
  const done = requests.filter((r) => r.status !== "pending").slice(0, 5);
  if (requests.length === 0) return null;
  return (
    <Card className="gap-3 p-4">
      <h2 className="text-base font-semibold">
        {t("inboxTitle")}
        {open.length > 0 && (
          <span className="ml-2 text-sm font-normal text-muted-foreground">
            {t("waiting", { count: open.length })}
          </span>
        )}
      </h2>
      {open.length === 0 && <p className="text-sm text-muted-foreground">{t("inboxEmpty")}</p>}
      <ul className="flex flex-col divide-y text-sm">
        {open.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="font-medium">{r.staffName}</span> · <Period r={r} /> · {reasons(r.reason)}
              {r.note && <span className="block text-xs text-muted-foreground">{r.note}</span>}
              {r.conflicts > 0 && (
                <span className="mt-0.5 flex items-center gap-1 text-xs text-warning-ink">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  {t("conflicts", { count: r.conflicts })}
                </span>
              )}
            </span>
            <Button
              className="h-11 md:h-8"
              disabled={pending}
              onClick={() => run(() => decideTimeOff(r.id, true))}
            >
              <Check aria-hidden />
              {t("approve")}
            </Button>
            <ConfirmDialog
              description={t("declineConfirm", { name: r.staffName })}
              onConfirm={() => run(() => decideTimeOff(r.id, false))}
              trigger={
                <Button variant="outline" className="h-11 md:h-8" disabled={pending}>
                  <X aria-hidden />
                  {t("decline")}
                </Button>
              }
            />
          </li>
        ))}
        {done.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2 text-muted-foreground">
            <span className="flex-1">
              {r.staffName} · <Period r={r} />
            </span>
            <StatusPill tone={TONE[r.status]}>{t(`status.${r.status}`)}</StatusPill>
          </li>
        ))}
      </ul>
      <FieldError code={error} />
    </Card>
  );
}
