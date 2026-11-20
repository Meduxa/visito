"use client";

// "Additional service not added" (decision 037): a note in the booking panel,
// and a small form to add the additional service to this visit by hand.
import { fromZonedTime } from "date-fns-tz";
import { TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { localized } from "@/lib/i18n-text";
import { cn } from "@/lib/utils";
import { addFollowUp, findSlots } from "../actions";
import type { Conflict } from "../engine/availability";
import type { MissingFollowUp } from "../followup";
import type { CalStaff } from "../queries";
import type { CatalogEntry } from "./new-booking-panel";

const hhmm = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
const localDate = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });

export function FollowUpAdder({
  bookingId,
  missing,
  staff,
  timeZone,
  locationId,
  canEdit,
  onAdded,
}: {
  bookingId: string;
  missing: MissingFollowUp<CatalogEntry>;
  staff: CalStaff[];
  timeZone: string;
  locationId?: string | null;
  canEdit: boolean;
  onAdded: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const { main, service, mainEnd, mainStaffId } = missing;
  const date = localDate(mainEnd, timeZone);
  const people = staff.filter((p) => service.staffIds.includes(p.id));
  const [who, setWho] = useState(
    people.some((p) => p.id === mainStaffId) ? mainStaffId : (people[0]?.id ?? ""),
  );
  const suggested = hhmm(
    new Date(new Date(mainEnd).getTime() + (main.followUp?.afterMin ?? 0) * 60_000).toISOString(),
    timeZone,
  );
  const [time, setTime] = useState(suggested);
  const [slots, setSlots] = useState<string[] | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string>();

  // free times for the additional service, after the main one ends
  useEffect(() => {
    if (!open || !who) return;
    let live = true;
    findSlots({ date, staffId: who, picks: [{ serviceId: service.id }], locationId }).then((r) => {
      if (!live) return;
      const from = new Date(mainEnd).getTime();
      setSlots(r.ok ? r.data.map((x) => x.start).filter((x) => new Date(x).getTime() >= from) : []);
    });
    return () => {
      live = false;
    };
  }, [open, who, date, service.id, locationId, mainEnd]);

  const add = (force = false) =>
    startTransition(async () => {
      setError(undefined);
      setConflicts([]);
      const r = await addFollowUp({
        bookingId,
        serviceId: service.id,
        staffId: who,
        start: fromZonedTime(`${date}T${time}`, timeZone).toISOString(),
        force,
      });
      if (!r.ok) {
        if (r.error === "conflicts" && "conflicts" in r) return setConflicts(r.conflicts);
        return setError(r.error);
      }
      toast.success(t("booking.followUp.added"));
      onAdded();
    });

  const name = localized(service.name, locale);
  return (
    <section
      className="flex flex-col gap-3 rounded-lg bg-warning-soft p-3 text-sm text-warning-ink"
      data-testid="followup-missing"
    >
      <p role="note" className="flex gap-2 font-medium">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {t("booking.followUp.missing", { service: name, main: localized(main.name, locale) })}
      </p>
      {canEdit && !open && (
        <Button
          type="button"
          variant="outline"
          className="h-11 self-start bg-card md:h-9"
          onClick={() => setOpen(true)}
        >
          {t("booking.followUp.addNow", { service: name })}
        </Button>
      )}
      {canEdit && open && (
        <div className="flex flex-col gap-3 rounded-md bg-card p-3 text-foreground">
          <div className="flex flex-wrap items-end gap-3">
            <FormField id="fa-time" label={t("booking.followUp.time")} className="w-32">
              <Input
                id="fa-time"
                type="time"
                step={300}
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11 md:h-9"
              />
            </FormField>
            {people.length > 1 && (
              <FormField id="fa-staff" label={t("booking.followUp.staff")} className="min-w-40 flex-1">
                <Select value={who} onValueChange={setWho}>
                  <SelectTrigger id="fa-staff" className="h-11 w-full md:h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          </div>
          {slots && slots.length > 0 && (
            <div
              role="radiogroup"
              aria-label={t("booking.followUp.freeTimes")}
              className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto"
              data-testid="followup-add-slots"
            >
              {slots.map((st) => {
                const hm = hhmm(st, timeZone);
                const on = hm === time;
                return (
                  <button
                    key={st}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setTime(hm)}
                    className={cn(
                      "min-h-9 rounded-md border px-2.5 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                      on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                    )}
                  >
                    {hm}
                  </button>
                );
              })}
            </div>
          )}
          {slots && slots.length === 0 && (
            <p className="text-xs text-muted-foreground">{t("booking.followUp.noFreeTimes")}</p>
          )}
          {conflicts.length > 0 && (
            <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
              {conflicts.map((c) => (
                <li key={c}>{t(`booking.conflicts.${c}`)}</li>
              ))}
            </ul>
          )}
          <FieldError code={error} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="h-11 md:h-9"
              disabled={pending || !who || !time}
              onClick={() => add()}
            >
              {t("booking.followUp.addConfirm")}
            </Button>
            {conflicts.length > 0 && conflicts.every((c) => c === "outsideHours" || c === "closed") && (
              <Button
                type="button"
                variant="outline"
                className="h-11 md:h-9"
                disabled={pending}
                onClick={() => add(true)}
              >
                {t("booking.bookAnyway")}
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
