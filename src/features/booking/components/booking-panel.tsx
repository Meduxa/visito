"use client";

import { fromZonedTime } from "date-fns-tz";
import { Phone, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { TimeInput } from "@/components/time-input";
import { DetailPanel } from "@/components/detail-panel";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/money";
import { useDates } from "@/lib/use-dates";
import { read } from "@/lib/read";
import type { ReadResult } from "../reads";
import { cancelFollowing, moveBooking, setBookingNote, setBookingStatus } from "../actions";
import type { Conflict } from "../engine/availability";
import { STATUS_TONE } from "../status-tone";
import type { CalBooking, CalStaff } from "../queries";
import { CheckoutPanel } from "./checkout-panel";
import { DentalNotes } from "./dental-notes";
import { FollowUpAdder } from "./followup-adder";
import type { CatalogEntry } from "./new-booking-panel";
import { missingFollowUp } from "../followup";
import { noClientKey } from "../client-label";

export { STATUS_TONE };

// Mirrors set_booking_status in the database.
const NEXT: Record<string, string[]> = {
  pending: ["confirmed", "cancelled_by_client", "cancelled_by_business"],
  confirmed: [
    "arrived",
    "in_progress",
    "completed",
    "no_show",
    "cancelled_by_client",
    "cancelled_by_business",
  ],
  arrived: ["in_progress", "completed", "no_show", "cancelled_by_client", "cancelled_by_business"],
  in_progress: ["completed"],
  completed: [],
  cancelled_by_client: ["confirmed"],
  cancelled_by_business: ["confirmed"],
  no_show: ["confirmed"],
};
const DESTRUCTIVE = ["no_show", "cancelled_by_client", "cancelled_by_business"];

const localTime = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
const localDate = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });

export function BookingPanel({
  booking,
  staff,
  timeZone,
  canEdit,
  isManager,
  isDental,
  onClose,
  onCancelled,
  catalog = [],
  locationId,
}: {
  booking: CalBooking | null;
  staff: CalStaff[];
  timeZone: string;
  canEdit: boolean;
  isManager: boolean;
  isDental: boolean;
  onClose: () => void;
  onCancelled?: (bookingId: string) => void;
  /** to see whether an additional service is missing (decision 037) */
  catalog?: CatalogEntry[];
  locationId?: string | null;
}) {
  const t = useTranslations();
  const dates = useDates();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(booking?.note ?? "");
  const [reason, setReason] = useState("");
  const [move, setMove] = useState({ date: "", time: "", staffId: "" });
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string>();
  const [paying, setPaying] = useState(false);
  const [history, setHistory] = useState<ReadResult<"bookingHistory">>([]);
  // after checkout: extra items (products) — and so the discount — so the lines add up (test plan #35)
  const [money, setMoney] = useState<{
    for: string;
    charges: { id: string; name: string; price_minor: number }[];
  }>({ for: "", charges: [] });
  const charges = booking && money.for === booking.id ? money.charges : [];

  useEffect(() => {
    if (!booking) return;
    let live = true;
    read("bookingHistory", booking.id, []).then((h) => live && setHistory(h));
    if (booking.items.reduce((s, i) => s + i.priceMinor, 0) !== booking.totalMinor)
      read("bookingMoney", booking.id, null).then(
        (m) => live && setMoney({ for: booking.id, charges: m?.charges ?? [] }),
      );
    return () => {
      live = false;
    };
  }, [booking]);

  if (!booking) return null;
  if (paying) return <CheckoutPanel booking={booking} staff={staff} onClose={onClose} />;

  const first = booking.items[0];
  // "earlier" no-shows: this visit itself does not count (test plan #46)
  const earlierNoShows = (booking.client?.noShows ?? 0) - (booking.status === "no_show" ? 1 : 0);
  const discountMinor =
    booking.items.reduce((s, i) => s + i.priceMinor, 0) +
    charges.reduce((s, c) => s + c.price_minor, 0) -
    booking.totalMinor;
  const staffName = staff.find((s) => s.id === first?.staffId)?.name ?? "";
  const date = localDate(booking.start, timeZone);
  const reschedule = {
    date: move.date || date,
    time: move.time || localTime(booking.start, timeZone),
    staffId: move.staffId || first?.staffId,
  };

  const status = (next: string) =>
    startTransition(async () => {
      setError(undefined);
      const r = await setBookingStatus(booking.id, next as "confirmed", reason);
      if (!r.ok) return setError(r.error);
      toast.success(t(`booking.status.${next as "confirmed"}`));
      if (DESTRUCTIVE.includes(next)) onCancelled?.(booking.id);
      onClose();
    });

  const doMove = (force = false) =>
    startTransition(async () => {
      setError(undefined);
      setConflicts([]);
      const r = await moveBooking({
        bookingId: booking.id,
        staffId: reschedule.staffId!,
        start: fromZonedTime(`${reschedule.date}T${reschedule.time}`, timeZone).toISOString(),
        force,
      });
      if (!r.ok) {
        if (r.error === "conflicts" && "conflicts" in r) return setConflicts(r.conflicts);
        return setError(r.error);
      }
      toast.success(t("booking.moved"));
      onClose();
    });

  const onlySoftConflicts =
    conflicts.length > 0 && conflicts.every((c) => c === "outsideHours" || c === "closed" || c === "timeOff");

  return (
    <DetailPanel
      open
      onOpenChange={(o) => !o && onClose()}
      title={booking.client?.name ?? t(noClientKey(booking))}
      description={`${dates.dayTitle(date)} · ${localTime(booking.start, timeZone)}–${localTime(booking.end, timeZone)}`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill tone={STATUS_TONE[booking.status]} dot>
            {t(`booking.status.${booking.status as "confirmed"}`)}
          </StatusPill>
          <span className="text-sm text-muted-foreground">
            {staffName} ·{" "}
            {t("booking.sourceLine", { source: t(`booking.sources.${booking.source as "admin"}`) })}
            {booking.recurrenceId && ` · ${t("booking.series")}`}
          </span>
        </div>

        {(() => {
          const missing = missingFollowUp(booking, catalog);
          return missing ? (
            <FollowUpAdder
              bookingId={booking.id}
              missing={missing}
              staff={staff}
              timeZone={timeZone}
              locationId={locationId}
              canEdit={canEdit}
              onAdded={onClose}
            />
          ) : null;
        })()}
        {booking.client?.importantNote && (
          <div role="note" className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {booking.client.importantNote}
          </div>
        )}
        {earlierNoShows > 0 && (
          <StatusPill tone="danger" className="self-start">
            {t("booking.noShows", { count: earlierNoShows })}
          </StatusPill>
        )}
        {booking.client?.phone && (
          <Button variant="outline" asChild className="h-11 self-start md:h-9">
            <a href={`tel:${booking.client.phone}`}>
              <Phone aria-hidden />
              {t("booking.call")} {booking.client.phone}
            </a>
          </Button>
        )}

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("booking.services")}</h3>
          <ul className="flex flex-col divide-y rounded-lg border text-sm">
            {booking.items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1">{i.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {localTime(i.start, timeZone)} ·{" "}
                  {i.priceType === "fixed"
                    ? formatMoney(i.priceMinor)
                    : t("format.priceFrom", { price: formatMoney(i.priceMinor) })}
                </span>
              </li>
            ))}
            {charges.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1">{c.name}</span>
                <span className="text-muted-foreground tabular-nums">{formatMoney(c.price_minor)}</span>
              </li>
            ))}
            {discountMinor > 0 && (
              <li className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1">{t("checkout.discount")}</span>
                <span className="text-muted-foreground tabular-nums">−{formatMoney(discountMinor)}</span>
              </li>
            )}
            <li className="flex items-center gap-3 px-3 py-2 font-medium">
              <span className="flex-1">{t("booking.total")}</span>
              <span className="tabular-nums">{formatMoney(booking.totalMinor)}</span>
            </li>
          </ul>
          {booking.paidMinor > 0 && (
            <StatusPill
              tone={booking.paidMinor >= booking.totalMinor ? "success" : "warning"}
              className="self-start"
            >
              {booking.paidMinor >= booking.totalMinor
                ? t("checkout.paid")
                : t("checkout.paidOf", {
                    paid: formatMoney(booking.paidMinor),
                    total: formatMoney(booking.totalMinor),
                  })}
            </StatusPill>
          )}
          {canEdit &&
            ["confirmed", "arrived", "in_progress", "completed"].includes(booking.status) &&
            booking.paidMinor < booking.totalMinor && (
              <Button className="h-11 self-start md:h-9" onClick={() => setPaying(true)}>
                {t("checkout.open")}
              </Button>
            )}
        </section>

        {canEdit && NEXT[booking.status].length > 0 && (
          <section className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              {NEXT[booking.status]
                .filter((s) => !DESTRUCTIVE.includes(s))
                .map((s) => (
                  <Button key={s} className="h-11 md:h-9" disabled={pending} onClick={() => status(s)}>
                    {booking.status.startsWith("cancelled") || booking.status === "no_show"
                      ? t("booking.actions.undo")
                      : t(`booking.actions.${s as "confirmed"}`)}
                  </Button>
                ))}
            </div>
            {NEXT[booking.status].some((s) => DESTRUCTIVE.includes(s)) && (
              <div className="flex flex-wrap items-end gap-2">
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={t("booking.cancelReason")}
                  aria-label={t("booking.cancelReason")}
                  className="h-11 max-w-60 md:h-9"
                />
                {booking.recurrenceId && NEXT[booking.status].includes("cancelled_by_client") && (
                  <ConfirmDialog
                    description={t("booking.confirmBody.cancelFollowing")}
                    confirmLabel={t("booking.cancelFollowing")}
                    onConfirm={() =>
                      startTransition(async () => {
                        const r = await cancelFollowing(booking.id, "cancelled_by_client", reason);
                        if (!r.ok) return setError(r.error);
                        toast.success(t("booking.status.cancelled_by_client"));
                        onClose();
                      })
                    }
                    trigger={
                      <Button variant="outline" className="h-11 md:h-9" disabled={pending}>
                        {t("booking.cancelFollowing")}
                      </Button>
                    }
                  />
                )}
                {NEXT[booking.status]
                  .filter((s) => DESTRUCTIVE.includes(s))
                  .map((s) => (
                    <ConfirmDialog
                      key={s}
                      description={t(`booking.confirmBody.${s as "no_show"}`)}
                      confirmLabel={t(`booking.actions.${s as "no_show"}`)}
                      onConfirm={() => status(s)}
                      trigger={
                        <Button variant="outline" className="h-11 md:h-9" disabled={pending}>
                          {t(`booking.actions.${s as "no_show"}`)}
                        </Button>
                      }
                    />
                  ))}
              </div>
            )}
          </section>
        )}

        {canEdit && ["pending", "confirmed", "arrived"].includes(booking.status) && (
          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-medium">{t("booking.reschedule")}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField id="mv-date" label={t("booking.date")}>
                <Input
                  id="mv-date"
                  type="date"
                  value={reschedule.date}
                  onChange={(e) => setMove({ ...move, date: e.target.value })}
                  className="h-11 md:h-9"
                />
              </FormField>
              <FormField id="mv-time" label={t("booking.time")}>
                <TimeInput
                  id="mv-time"
                  value={reschedule.time}
                  onChange={(v) => setMove({ ...move, time: v })}
                  className="h-11 md:h-9"
                />
              </FormField>
              {isManager && (
                <FormField id="mv-staff" label={t("booking.staff")}>
                  <Select value={reschedule.staffId} onValueChange={(v) => setMove({ ...move, staffId: v })}>
                    <SelectTrigger id="mv-staff" className="h-11 w-full md:h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            </div>
            {conflicts.length > 0 && (
              <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
                {conflicts.map((c) => (
                  <li key={c}>{t(`booking.conflicts.${c}`)}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-11 md:h-9"
                disabled={pending}
                onClick={() => doMove(false)}
              >
                {t("booking.move")}
              </Button>
              {onlySoftConflicts && isManager && (
                <Button
                  variant="outline"
                  className="h-11 md:h-9"
                  disabled={pending}
                  onClick={() => doMove(true)}
                >
                  {t("booking.bookAnyway")}
                </Button>
              )}
            </div>
          </section>
        )}

        {booking.clientComment && (
          <section className="flex flex-col gap-1 rounded-lg bg-muted/60 p-3">
            <h3 className="text-sm font-medium">{t("booking.clientComment")}</h3>
            <p className="text-sm whitespace-pre-line">{booking.clientComment}</p>
          </section>
        )}

        {canEdit && (
          <section className="flex flex-col gap-2">
            <FormField id="bk-note" label={t("booking.note")} hint={t("booking.noteHint")}>
              <Textarea id="bk-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </FormField>
            <Button
              variant="outline"
              className="h-11 self-start md:h-9"
              disabled={pending || note === (booking.note ?? "")}
              onClick={() =>
                startTransition(async () => {
                  const r = await setBookingNote(booking.id, note);
                  if (r.ok) toast.success(t("common.saved"));
                  else setError(r.error);
                })
              }
            >
              {t("booking.saveNote")}
            </Button>
          </section>
        )}
        <FieldError code={error} />

        {isDental && booking.client && (
          <DentalNotes clientId={booking.client.id} bookingId={booking.id} timeZone={timeZone} />
        )}

        {history.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">{t("booking.history")}</h3>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {history.map((h) => (
                <li key={h.id}>
                  {localDate(h.changed_at, timeZone)} {localTime(h.changed_at, timeZone)} ·{" "}
                  {h.reason === "rescheduled"
                    ? t("booking.rescheduled")
                    : t(`booking.status.${h.to_status as "confirmed"}`)}
                  {h.reason && h.reason !== "rescheduled" && ` — ${h.reason}`}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </DetailPanel>
  );
}
