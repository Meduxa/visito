"use client";

import { fromZonedTime } from "date-fns-tz";
import { TriangleAlert, UserPlus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { DetailPanel } from "@/components/detail-panel";
import { FieldError } from "@/components/field-error";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { localized, type I18nText } from "@/lib/i18n-text";
import { useFormat, type PriceShape } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { createBooking, createRecurring, findClients, findSlots, previewRecurring } from "../actions";
import { addToWaitlist } from "../waitlist-actions";
import { useDates } from "@/lib/use-dates";
import type { Conflict } from "../engine/availability";
import type { CalStaff } from "../queries";

export type CatalogEntry = PriceShape & {
  id: string;
  name: I18nText;
  categoryName: string;
  durationMin: number;
  /** preparation time after the service (blocks the same specialist) */
  bufferMin?: number;
  staffIds: string[];
  /** "requires an additional service" (decision 037) */
  followUp?: { serviceId: string; afterMin: number } | null;
};
type ClientHit = Awaited<ReturnType<typeof findClients>>[number];

const ANY = "any";
const hhmm = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

export function NewBookingPanel({
  open,
  onClose,
  initial,
  staff,
  catalog,
  timeZone,
  isManager,
  ownStaffId,
  preset,
  onCreated,
  locationId = null,
}: {
  open: boolean;
  onClose: () => void;
  initial: { date: string; time: string | null; staffId: string | null };
  staff: CalStaff[];
  catalog: CatalogEntry[];
  timeZone: string;
  isManager: boolean;
  ownStaffId: string | null;
  preset?: { client: ClientHit; serviceIds: string[] };
  onCreated?: (bookingId: string) => void;
  /** the calendar's branch (decision 032) */
  locationId?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmt = useFormat();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [client, setClient] = useState<ClientHit | null>(preset?.client ?? null);
  const [newClient, setNewClient] = useState<{ firstName: string; lastName: string; phone: string } | null>(
    null,
  );
  const [walkIn, setWalkIn] = useState(false);
  const [picked, setPicked] = useState<string[]>(preset?.serviceIds ?? []);
  const [staffId, setStaffId] = useState<string>(isManager ? (initial.staffId ?? ANY) : (ownStaffId ?? ""));
  const [date, setDate] = useState(initial.date);
  const [slots, setSlots] = useState<{ start: string; staffId: string; staffName: string }[] | null>(null);
  const [chosen, setChosen] = useState<{ start: string; staffId: string } | null>(null);
  const [otherTime, setOtherTime] = useState(initial.time ?? "");
  const [note, setNote] = useState("");
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  // the additional service (decision 037): on by default, time and person can be changed
  const [fuOn, setFuOn] = useState(true);
  const [fuTime, setFuTime] = useState(""); // "" = the suggested time
  const [fuStaff, setFuStaff] = useState(""); // "" = the same specialist
  const [fuSlots, setFuSlots] = useState<string[] | null>(null); // free starts for the additional service
  const [fuConflicts, setFuConflicts] = useState<Conflict[]>([]);
  const [error, setError] = useState<string>();
  const dates = useDates();
  const [repeat, setRepeat] = useState(false);
  const [everyWeeks, setEveryWeeks] = useState(1);
  const [times, setTimes] = useState(4);
  const [series, setSeries] = useState<{ start: string; conflicts: Conflict[]; include: boolean }[] | null>(
    null,
  );

  // client search, debounced
  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(() => findClients(q).then(setHits), 250);
    return () => clearTimeout(id);
  }, [q]);

  // services this person does (all, for "anyone")
  const available = useMemo(
    () => catalog.filter((s) => staffId === ANY || !staffId || s.staffIds.includes(staffId)),
    [catalog, staffId],
  );
  const groups = [...new Set(available.map((s) => s.categoryName))];

  // free times for the chosen services / person / day
  useEffect(() => {
    if (!open || picked.length === 0 || !staffId) return;
    let live = true;
    findSlots({ date, staffId, picks: picked.map((serviceId) => ({ serviceId })), locationId }).then((r) => {
      if (!live) return;
      const list = r.ok ? r.data : [];
      setSlots(list);
      // keep the time that was clicked in the calendar, if it is free
      const clicked =
        initial.time &&
        list.find(
          (s) => hhmm(s.start, timeZone) === initial.time && (staffId === ANY || s.staffId === staffId),
        );
      setChosen(clicked ? { start: clicked.start, staffId: clicked.staffId } : null);
    });
    return () => {
      live = false;
    };
  }, [open, picked, staffId, date, initial.time, timeZone, locationId]);

  // which picked service needs an additional one, and when it would start
  const needs = picked
    .map((id) => catalog.find((c) => c.id === id))
    .find((c) => c?.followUp && catalog.some((x) => x.id === c.followUp!.serviceId));
  const fuService = needs ? catalog.find((x) => x.id === needs.followUp!.serviceId) : undefined;
  const mainStart =
    chosen?.start ??
    (otherTime && staffId !== ANY ? fromZonedTime(`${date}T${otherTime}`, timeZone).toISOString() : null);
  const mainStaff = chosen?.staffId ?? (staffId !== ANY ? staffId : null);
  const mainMin = picked.reduce((sum, id) => sum + (catalog.find((c) => c.id === id)?.durationMin ?? 0), 0);
  const fuSuggested =
    mainStart && needs
      ? hhmm(
          new Date(
            new Date(mainStart).getTime() + (mainMin + needs.followUp!.afterMin) * 60_000,
          ).toISOString(),
          timeZone,
        )
      : "";
  const fuAt = fuTime || fuSuggested;
  const fuPeople = fuService ? staff.filter((p) => fuService.staffIds.includes(p.id)) : [];
  const fuWho =
    fuStaff || (mainStaff && fuPeople.some((p) => p.id === mainStaff) ? mainStaff : (fuPeople[0]?.id ?? ""));
  const withFollowUp = !!(needs && fuService && fuOn && !repeat && fuAt && fuWho);

  // free times for the additional service: same day, its specialist, after the first part ends
  const lastBuffer = catalog.find((c) => c.id === picked.at(-1))?.bufferMin ?? 0;
  const fuFrom = mainStart
    ? new Date(mainStart).getTime() + (mainMin + (fuWho === mainStaff ? lastBuffer : 0)) * 60_000
    : null;
  const fuServiceId = fuService?.id;
  const fuShow = !!(fuServiceId && fuOn && !repeat && fuWho && fuFrom);
  useEffect(() => {
    if (!fuShow) return;
    let live = true;
    findSlots({ date, staffId: fuWho, picks: [{ serviceId: fuServiceId! }], locationId }).then((r) => {
      if (live)
        setFuSlots(r.ok ? r.data.map((x) => x.start).filter((x) => new Date(x).getTime() >= fuFrom!) : []);
    });
    return () => {
      live = false;
    };
  }, [fuShow, date, fuWho, fuServiceId, fuFrom, locationId]);

  const submit = (force = false) =>
    startTransition(async () => {
      setError(undefined);
      setConflicts([]);
      setFuConflicts([]);
      const target =
        chosen ??
        (otherTime && staffId !== ANY
          ? { start: fromZonedTime(`${date}T${otherTime}`, timeZone).toISOString(), staffId }
          : null);
      if (!target) return setError("invalidInput");
      if (repeat) {
        const starts = (series ?? []).filter((x) => x.include).map((x) => x.start);
        if (starts.length < 2) return setError("needTwo");
        const r = await createRecurring({
          clientId: client?.id ?? null,
          picks: picked.map((serviceId) => ({ serviceId })),
          staffId: target.staffId,
          starts,
          everyWeeks,
          note,
          locationId,
        });
        if (!r.ok) return setError(r.error);
        toast.success(t("booking.seriesSaved", { count: r.data.count }));
        return onClose();
      }
      const r = await createBooking({
        clientId: client?.id ?? null,
        newClient: !client && newClient ? newClient : null,
        picks: picked.map((serviceId) => ({ serviceId })),
        staffId: target.staffId,
        start: target.start,
        note,
        source: walkIn ? "walk_in" : "admin",
        force,
        locationId,
        followUp: withFollowUp
          ? {
              serviceId: fuService!.id,
              staffId: fuWho,
              start: fromZonedTime(`${date}T${fuAt}`, timeZone).toISOString(),
            }
          : null,
      });
      if (!r.ok) {
        if (r.error === "conflicts" && "conflicts" in r)
          return "part" in r && r.part === "followUp"
            ? setFuConflicts(r.conflicts)
            : setConflicts(r.conflicts);
        return setError(r.error);
      }
      toast.success(t("booking.created"));
      onCreated?.(r.data.id);
      onClose();
    });

  const softOnly = conflicts.length > 0 && conflicts.every((c) => c === "outsideHours" || c === "closed");
  const hasClient = !!client || walkIn || (newClient && newClient.firstName.trim());
  const ready =
    hasClient && picked.length > 0 && (chosen || (otherTime && staffId !== ANY)) && (!repeat || !!series);

  return (
    <DetailPanel open={open} onOpenChange={(o) => !o && onClose()} title={t("calendar.newBooking")}>
      <div className="flex flex-col gap-6">
        {/* 1. client */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("booking.client")}</h3>
          {client ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm font-medium">
                  {[client.first_name, client.last_name].filter(Boolean).join(" ")}{" "}
                  <span className="font-normal text-muted-foreground">{client.phone_e164}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("common.close")}
                  onClick={() => setClient(null)}
                >
                  <X aria-hidden />
                </Button>
              </div>
              {client.important_note && (
                <p role="note" className="flex gap-2 rounded-md bg-warning-soft p-2 text-sm text-warning-ink">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {client.important_note}
                </p>
              )}
              {client.no_show_count > 0 && (
                <p className="text-xs text-destructive-ink">
                  {t("booking.noShows", { count: client.no_show_count })}
                </p>
              )}
            </div>
          ) : newClient ? (
            <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-3">
              <Input
                autoFocus
                placeholder={t("clients.fields.firstName")}
                aria-label={t("clients.fields.firstName")}
                value={newClient.firstName}
                onChange={(e) => setNewClient({ ...newClient, firstName: e.target.value })}
                className="h-11 md:h-9"
              />
              <Input
                placeholder={t("clients.fields.lastName")}
                aria-label={t("clients.fields.lastName")}
                value={newClient.lastName}
                onChange={(e) => setNewClient({ ...newClient, lastName: e.target.value })}
                className="h-11 md:h-9"
              />
              <Input
                type="tel"
                inputMode="tel"
                placeholder={t("clients.fields.phone")}
                aria-label={t("clients.fields.phone")}
                value={newClient.phone}
                onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                className="h-11 md:h-9"
              />
              <Button
                variant="ghost"
                size="sm"
                className="justify-self-start sm:col-span-3"
                onClick={() => setNewClient(null)}
              >
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <>
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("booking.findClient")}
                aria-label={t("booking.findClient")}
                disabled={walkIn}
                className="h-11 md:h-9"
              />
              {q.trim().length >= 2 && hits.length > 0 && !walkIn && (
                <ul className="flex flex-col divide-y rounded-lg border">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        onClick={() => setClient(h)}
                        className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                      >
                        <span className="flex-1">
                          {[h.first_name, h.last_name].filter(Boolean).join(" ")}
                        </span>
                        <span className="text-muted-foreground">{h.phone_e164}</span>
                        {h.important_note && <TriangleAlert className="size-3.5 text-warning" aria-hidden />}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9"
                  disabled={walkIn}
                  onClick={() =>
                    setNewClient({
                      firstName: q.replace(/[\d+\s-]+/g, " ").trim(),
                      lastName: "",
                      phone: q.replace(/[^\d+]/g, ""),
                    })
                  }
                >
                  <UserPlus aria-hidden />
                  {t("booking.newClient")}
                </Button>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={walkIn} onCheckedChange={(v) => setWalkIn(v === true)} />
                  {t("booking.walkInNoClient")}
                </label>
              </div>
            </>
          )}
        </section>

        {/* 2. who */}
        {isManager && (
          <FormField id="nb-staff" label={t("booking.chooseStaff")}>
            <Select
              value={staffId}
              onValueChange={(v) => {
                setStaffId(v);
                setPicked((p) =>
                  p.filter((id) => v === ANY || catalog.find((c) => c.id === id)?.staffIds.includes(v)),
                );
              }}
            >
              <SelectTrigger id="nb-staff" className="h-11 w-full md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>{t("booking.anyStaff")}</SelectItem>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {/* 3. services */}
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">{t("booking.chooseServices")}</h3>
          <div className="max-h-72 overflow-y-auto rounded-lg border">
            {groups.map((g) => (
              <div key={g}>
                <p className="sticky top-0 bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  {g}
                </p>
                {available
                  .filter((s) => s.categoryName === g)
                  .map((s) => (
                    <label
                      key={s.id}
                      className="flex min-h-11 cursor-pointer items-center gap-3 border-t px-3 py-1.5 text-sm"
                    >
                      <Checkbox
                        checked={picked.includes(s.id)}
                        onCheckedChange={(v) =>
                          setPicked((p) => (v === true ? [...p, s.id] : p.filter((x) => x !== s.id)))
                        }
                      />
                      <span className="flex-1">{localized(s.name, locale)}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmt.duration(s.durationMin)} · {fmt.price(s)}
                      </span>
                    </label>
                  ))}
              </div>
            ))}
          </div>
        </section>

        {/* 4. when */}
        <section className="flex flex-col gap-3">
          <FormField id="nb-date" label={t("booking.date")} className="max-w-48">
            <Input
              id="nb-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-11 md:h-9"
            />
          </FormField>
          {picked.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t("booking.freeTimes")}</span>
              {slots === null ? (
                <span className="text-sm text-muted-foreground">…</span>
              ) : slots.length === 0 ? (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-muted-foreground">{t("booking.noFreeTimes")}</p>
                  {client && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          const until = new Date(`${date}T12:00:00Z`);
                          until.setUTCDate(until.getUTCDate() + 7);
                          const r = await addToWaitlist({
                            clientId: client.id,
                            serviceId: picked[0],
                            staffId: staffId === ANY ? null : staffId,
                            dateFrom: date,
                            dateTo: until.toISOString().slice(0, 10),
                            timeFrom: null,
                            timeTo: null,
                            note,
                          });
                          if (!r.ok) return setError(r.error);
                          toast.success(t("waitlist.added"));
                          onClose();
                        })
                      }
                    >
                      {t("waitlist.add")}
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  role="radiogroup"
                  aria-label={t("booking.freeTimes")}
                  className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto"
                >
                  {slots.map((s) => {
                    const on = chosen?.start === s.start && chosen.staffId === s.staffId;
                    return (
                      <button
                        key={s.start + s.staffId}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        title={s.staffName}
                        onClick={() => {
                          setChosen({ start: s.start, staffId: s.staffId });
                          setOtherTime("");
                        }}
                        className={cn(
                          "min-h-9 rounded-md border px-2.5 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                          on ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted",
                        )}
                      >
                        {hhmm(s.start, timeZone)}
                        {staffId === ANY && (
                          <span className="ml-1 text-xs opacity-75">{s.staffName.split(" ")[0]}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
              {isManager && staffId !== ANY && (
                <FormField id="nb-other" label={t("booking.otherTime")} className="max-w-40">
                  <Input
                    id="nb-other"
                    type="time"
                    step={300}
                    value={otherTime}
                    onChange={(e) => {
                      setOtherTime(e.target.value);
                      setChosen(null);
                    }}
                    className="h-11 md:h-9"
                  />
                </FormField>
              )}
            </div>
          )}
        </section>

        {needs && fuService && mainStart && !repeat && (
          <section
            className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-accent/40 p-3"
            data-testid="followup-reminder"
            aria-live="polite"
          >
            <p className="text-sm font-medium">
              {t("booking.followUp.title", { service: localized(needs.name, locale) })}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={fuOn} onCheckedChange={(v) => setFuOn(v === true)} />
              {t("booking.followUp.add", {
                service: localized(fuService.name, locale),
                minutes: fuService.durationMin,
              })}
            </label>
            {fuOn && (
              <div className="flex flex-wrap items-end gap-3">
                <FormField id="nb-fu-time" label={t("booking.followUp.time")} className="w-32">
                  <Input
                    id="nb-fu-time"
                    type="time"
                    step={300}
                    value={fuAt}
                    onChange={(e) => setFuTime(e.target.value)}
                    className="h-11 md:h-9"
                  />
                </FormField>
                {fuPeople.length > 1 && (
                  <FormField id="nb-fu-staff" label={t("booking.followUp.staff")} className="min-w-40 flex-1">
                    <Select value={fuWho} onValueChange={setFuStaff}>
                      <SelectTrigger id="nb-fu-staff" className="h-11 w-full md:h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fuPeople.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
                <p className="w-full text-xs text-muted-foreground">
                  {t("booking.followUp.hint", { minutes: needs.followUp!.afterMin })}
                </p>
                {fuSlots && fuSlots.length > 0 && (
                  <div
                    role="radiogroup"
                    aria-label={t("booking.followUp.freeTimes")}
                    className="flex max-h-32 w-full flex-wrap gap-1.5 overflow-y-auto"
                    data-testid="followup-slots"
                  >
                    {fuSlots.map((st) => {
                      const hm = hhmm(st, timeZone);
                      const on = hm === fuAt;
                      return (
                        <button
                          key={st}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => setFuTime(hm)}
                          className={cn(
                            "min-h-9 rounded-md border px-2.5 text-sm tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "bg-card hover:bg-muted",
                          )}
                        >
                          {hm}
                        </button>
                      );
                    })}
                  </div>
                )}
                {fuSlots && fuSlots.length === 0 && (
                  <p className="w-full text-xs text-muted-foreground">{t("booking.followUp.noFreeTimes")}</p>
                )}
              </div>
            )}
            {fuConflicts.length > 0 && (
              <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
                {fuConflicts.map((c) => (
                  <li key={c}>{t(`booking.conflicts.${c}`)}</li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(chosen || (otherTime && staffId !== ANY)) && client && (
          <section className="flex flex-col gap-3 rounded-lg border p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Checkbox
                checked={repeat}
                onCheckedChange={(v) => {
                  setRepeat(v === true);
                  setSeries(null);
                }}
              />
              {t("booking.repeat")}
            </label>
            {repeat && (
              <>
                <div className="flex flex-wrap items-end gap-2">
                  <FormField id="nb-every" label={t("booking.everyWeeks")} className="w-32">
                    <Input
                      id="nb-every"
                      type="number"
                      min={1}
                      max={12}
                      value={everyWeeks}
                      onChange={(e) => {
                        setEveryWeeks(Number(e.target.value) || 1);
                        setSeries(null);
                      }}
                      className="h-11 md:h-9"
                    />
                  </FormField>
                  <FormField id="nb-times" label={t("booking.times")} className="w-28">
                    <Input
                      id="nb-times"
                      type="number"
                      min={2}
                      max={52}
                      value={times}
                      onChange={(e) => {
                        setTimes(Number(e.target.value) || 2);
                        setSeries(null);
                      }}
                      className="h-11 md:h-9"
                    />
                  </FormField>
                  <Button
                    variant="outline"
                    className="h-11 md:h-9"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        const start =
                          chosen?.start ?? fromZonedTime(`${date}T${otherTime}`, timeZone).toISOString();
                        const r = await previewRecurring({
                          clientId: client.id,
                          picks: picked.map((serviceId) => ({ serviceId })),
                          staffId: chosen?.staffId ?? staffId,
                          start,
                          everyWeeks,
                          times: Math.min(52, Math.max(2, times)),
                          locationId,
                        });
                        if (!r.ok) return setError(r.error);
                        setSeries(r.data.map((x) => ({ ...x, include: x.conflicts.length === 0 })));
                      })
                    }
                  >
                    {t("booking.checkDates")}
                  </Button>
                </div>
                {series && (
                  <ul className="flex flex-col divide-y rounded-md border text-sm">
                    {series.map((x, i) => {
                      const d = new Date(x.start).toLocaleDateString("en-CA", { timeZone });
                      return (
                        <li key={x.start} className="flex flex-wrap items-center gap-2 px-3 py-1.5">
                          <Checkbox
                            checked={x.include}
                            onCheckedChange={(v) =>
                              setSeries((s) =>
                                s!.map((y, k) => (k === i ? { ...y, include: v === true } : y)),
                              )
                            }
                            aria-label={dates.dayTitle(d)}
                          />
                          <span className="flex-1">
                            {dates.dayTitle(d)} · {hhmm(x.start, timeZone)}
                          </span>
                          {x.conflicts.map((c) => (
                            <span key={c} className="text-xs text-destructive">
                              {t(`booking.conflicts.${c}`)}
                            </span>
                          ))}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )}
          </section>
        )}

        <FormField id="nb-note" label={`${t("booking.note")} (${t("common.optional")})`}>
          <Textarea id="nb-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </FormField>

        {conflicts.length > 0 && (
          <ul role="alert" className="flex flex-col gap-1 text-sm text-destructive">
            {conflicts.map((c) => (
              <li key={c}>{t(`booking.conflicts.${c}`)}</li>
            ))}
          </ul>
        )}
        {error === "needTwo" ? (
          <p role="alert" className="text-sm text-destructive">
            {t("booking.needTwo")}
          </p>
        ) : (
          <FieldError code={error} />
        )}
        <div className="flex flex-wrap gap-2">
          <Button className="h-11 md:h-9" disabled={pending || !ready} onClick={() => submit(false)}>
            {t("booking.create")}
          </Button>
          {softOnly && isManager && (
            <Button variant="outline" className="h-11 md:h-9" disabled={pending} onClick={() => submit(true)}>
              {t("booking.bookAnyway")}
            </Button>
          )}
        </div>
      </div>
    </DetailPanel>
  );
}
