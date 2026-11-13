"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "@/i18n/navigation";
import { fullDateTime, ymdIn } from "@/lib/date-format";
import { addDays } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { STATUS_TONE } from "../../booking/status-tone";
import { manageCancel, manageMove, manageSlots, type ManageView } from "../actions";

type View = Omit<ManageView, "tenantId" | "bookingId">;
type Slot = { start: string };

const timeIn = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

export function ManageBooking({ token, view }: { token: string; view: View }) {
  const t = useTranslations();
  const tm = useTranslations("manageBooking");
  const router = useRouter();
  const tz = view.timeZone;
  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(() => ymdIn(view.start, tz));
  const [found, setFound] = useState<{ date: string; slots: Slot[] } | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const slots = found?.date === date ? found.slots : null;

  useEffect(() => {
    if (!moving) return;
    let live = true;
    manageSlots(token, date).then((r) => {
      if (!live) return;
      setFound({ date, slots: r.ok ? r.data : [] });
      if (!r.ok) setError(r.error);
    });
    return () => {
      live = false;
    };
  }, [moving, date, token]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, done: string) =>
    startTransition(async () => {
      setError(undefined);
      const r = await fn();
      if (!r.ok) return setError(r.error);
      setNotice(done);
      setMoving(false);
      router.refresh();
    });

  const today = ymdIn(new Date().toISOString(), tz);

  return (
    <Card className="gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{view.business}</p>
        <h1 className="text-2xl font-semibold">{tm("title")}</h1>
      </div>
      <StatusPill tone={STATUS_TONE[view.status]} dot className="self-start">
        {t(`booking.status.${view.status}` as "booking.status.confirmed")}
      </StatusPill>
      <dl className="grid gap-3 text-sm sm:grid-cols-[8rem_1fr]">
        <dt className="text-muted-foreground">{tm("when")}</dt>
        <dd className="font-medium">{fullDateTime(t, view.start, tz)}</dd>
        <dt className="text-muted-foreground">{tm("services")}</dt>
        <dd>
          {view.items.map((i) => i.name).join(", ")} ·{" "}
          {[...new Set(view.items.map((i) => i.staff))].join(", ")}
          <span className="block text-muted-foreground">{formatMoney(view.totalMinor)}</span>
        </dd>
        {(view.address || view.branch) && (
          <>
            <dt className="text-muted-foreground">{tm("where")}</dt>
            <dd>{[view.branch, view.address].filter(Boolean).join(" · ")}</dd>
          </>
        )}
      </dl>

      {notice && (
        <p role="status" className="rounded-lg bg-success-soft p-3 text-sm text-success-ink">
          {notice}
        </p>
      )}

      {view.changeable ? (
        <>
          {view.cancelWindowMin > 0 && (
            <p className="text-xs text-muted-foreground">
              {tm("policy", { hours: Math.round((view.cancelWindowMin / 60) * 10) / 10 })}
            </p>
          )}
          {moving && (
            <section className="flex flex-col gap-3 rounded-lg border p-3">
              <h2 className="text-sm font-medium">{tm("chooseNew")}</h2>
              <FormField id="mb-date" label={tm("when")} className="max-w-48">
                <Input
                  id="mb-date"
                  type="date"
                  min={today}
                  max={addDays(today, 365)}
                  className="h-11 md:h-9"
                  value={date}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setDate(e.target.value);
                    setChosen(null);
                  }}
                />
              </FormField>
              {slots === null ? (
                <p className="text-sm text-muted-foreground">…</p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("publicBooking.noSlots")}</p>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={tm("chooseNew")}
                  className="grid grid-cols-4 gap-2 sm:grid-cols-6"
                >
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      role="radio"
                      aria-checked={chosen === s.start}
                      onClick={() => setChosen(s.start)}
                      className={cn(
                        "h-11 rounded-lg border text-sm font-medium tabular-nums hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                        chosen === s.start && "border-primary bg-accent",
                      )}
                    >
                      {timeIn(s.start, tz)}
                    </button>
                  ))}
                </div>
              )}
              {chosen && (
                <Button
                  className="h-11 self-start md:h-9"
                  disabled={pending}
                  onClick={() => run(() => manageMove(token, chosen), tm("moved"))}
                >
                  {tm("move", { time: fullDateTime(t, chosen, tz) })}
                </Button>
              )}
            </section>
          )}
          <FieldError code={error} />
          <div className="flex flex-wrap gap-2">
            {!moving && (
              <Button variant="outline" className="h-11 md:h-9" onClick={() => setMoving(true)}>
                {tm("reschedule")}
              </Button>
            )}
            <ConfirmDialog
              trigger={
                <Button variant="outline" className="h-11 text-destructive md:h-9" disabled={pending}>
                  {tm("cancel")}
                </Button>
              }
              title={tm("cancelConfirm")}
              description={tm("cancelBody")}
              confirmLabel={tm("cancel")}
              onConfirm={() => run(() => manageCancel(token), tm("cancelled"))}
            />
          </div>
        </>
      ) : (
        ["pending", "confirmed"].includes(view.status) && (
          <p className="text-sm text-muted-foreground">
            {tm("tooLate", { business: view.business })}{" "}
            {view.phone && (
              <a className="font-medium text-foreground underline" href={`tel:${view.phone}`}>
                {view.phone}
              </a>
            )}
          </p>
        )
      )}
    </Card>
  );
}
