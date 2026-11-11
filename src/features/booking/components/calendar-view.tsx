"use client";

import { ChevronLeft, ChevronRight, Plus, TriangleAlert, Upload, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StaffAvatar } from "@/features/staff/components/staff-avatar";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { addDays, addMonths, monthGrid, weekDates } from "@/lib/dates";
import { createClient } from "@/lib/supabase/client";
import { useDates } from "@/lib/use-dates";
import { cn } from "@/lib/utils";
import { moveBooking } from "../actions";
import type { CalBooking, CalendarData } from "../queries";
import { BookingPanel, STATUS_TONE } from "./booking-panel";
import { NewBookingPanel, type CatalogEntry } from "./new-booking-panel";
import { TimeGrid, type GridColumn } from "./time-grid";
import { setWaitlistStatus, waitlistMatches, type WaitlistEntry } from "../waitlist-actions";
import { WaitlistPanel } from "./waitlist-panel";

export type CalendarView = "day" | "week" | "list" | "month";
export type DayBy = "staff" | "chair";
const VIEWS: CalendarView[] = ["day", "week", "list", "month"];
const HIDDEN_IN_GRID = ["cancelled_by_client", "cancelled_by_business"];

const useWide = () =>
  useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia("(min-width: 768px)");
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => true,
  );

// Booking colours by specialist or by service — a per-device choice, remembered in the browser.
type ColorBy = "staff" | "service";
const COLOR_KEY = "bk_calendar_color";
const colorListeners = new Set<() => void>();
const readColorBy = (): ColorBy => {
  try {
    return localStorage.getItem(COLOR_KEY) === "service" ? "service" : "staff";
  } catch {
    return "staff";
  }
};
const useColorBy = () => {
  const value = useSyncExternalStore(
    (cb) => {
      colorListeners.add(cb);
      return () => colorListeners.delete(cb);
    },
    readColorBy,
    () => "staff" as ColorBy,
  );
  const set = (v: ColorBy) => {
    try {
      localStorage.setItem(COLOR_KEY, v);
    } catch {
      // private window: the choice lasts until the page is reloaded
    }
    colorListeners.forEach((cb) => cb());
  };
  return [value, set] as const;
};

const localDate = (iso: string, tz: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });
const localTime = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });

export function CalendarScreen({
  data,
  date,
  today,
  viewParam,
  weekStaffId,
  openBookingId = null,
  tenantId,
  catalog,
  isManager,
  isDental,
  ownStaffId,
  waitlist,
  dayBy,
  bookFor = null,
}: {
  data: CalendarData;
  date: string;
  today: string;
  viewParam: CalendarView | null;
  weekStaffId: string | null;
  openBookingId?: string | null;
  tenantId: string;
  catalog: CatalogEntry[];
  isManager: boolean;
  isDental: boolean;
  ownStaffId: string | null;
  waitlist: WaitlistEntry[];
  dayBy: DayBy;
  /** "New booking" from a client card: open the form for this client at once */
  bookFor?: {
    id: string;
    first_name: string;
    last_name: string | null;
    phone_e164: string | null;
    important_note: string | null;
    no_show_count: number;
  } | null;
}) {
  const t = useTranslations();
  const dates = useDates();
  const router = useRouter();
  const pathname = usePathname();
  const wide = useWide();
  const view: CalendarView = viewParam ?? (wide ? "day" : "list");
  const [openBooking, setOpenBooking] = useState<string | null>(openBookingId);
  // a link with ?booking=<id> (e.g. from a notification) opens that booking
  const [seenOpenParam, setSeenOpenParam] = useState(openBookingId);
  if (seenOpenParam !== openBookingId) {
    setSeenOpenParam(openBookingId);
    if (openBookingId) setOpenBooking(openBookingId);
  }
  const [creating, setCreating] = useState<{
    date: string;
    time: string | null;
    staffId: string | null;
    fromWaitlist?: WaitlistEntry;
    forClient?: NonNullable<typeof bookFor>;
  } | null>(
    bookFor ? { date: today, time: null, staffId: isManager ? null : ownStaffId, forClient: bookFor } : null,
  );
  const [waitOpen, setWaitOpen] = useState(false);
  const [waitHighlight, setWaitHighlight] = useState<string[]>([]);
  // the cancelled booking whose time the highlighted clients could take
  const [freedBooking, setFreedBooking] = useState<string | null>(null);
  const tz = data.timeZone;
  // Optimistic moves: a dropped booking stays where it was dropped until the
  // refreshed data arrives (or snaps back if the move failed).
  const [moved, setMoved] = useState<Record<string, { staffId: string; start: number; end: number }>>({});
  const [seen, setSeen] = useState(data);
  if (seen !== data) {
    setSeen(data);
    setMoved({});
  }

  const go = (patch: Partial<{ date: string; view: CalendarView; staff: string; by: DayBy }>) => {
    const p = new URLSearchParams({
      date,
      ...(viewParam && { view: viewParam }),
      ...(weekStaffId && { staff: weekStaffId }),
      ...(dayBy === "chair" && { by: "chair" }),
      ...patch,
    });
    router.push(`${pathname}?${p}`);
  };

  // Live updates: any change to this business's bookings refreshes the view.
  const refreshTimer = useRef<ReturnType<typeof setTimeout>>(null);
  useEffect(() => {
    const db = createClient();
    const refresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 400);
    };
    const channel = db
      .channel(`calendar-${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `tenant_id=eq.${tenantId}` },
        refresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "booking_items", filter: `tenant_id=eq.${tenantId}` },
        refresh,
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [tenantId, router]);

  const step = view === "month" ? 0 : view === "week" || view === "list" ? 7 : 1;
  const shift = (dir: -1 | 1) =>
    go({ date: view === "month" ? addMonths(date, dir) : addDays(date, dir * step) });
  const title =
    view === "month"
      ? dates.monthYear(date)
      : view === "week"
        ? `${dates.dayShort(weekDates(date)[0])} – ${dates.dayShort(weekDates(date)[6])}`
        : view === "list"
          ? `${dates.dayShort(date)} – ${dates.dayShort(addDays(date, 6))}`
          : dates.dayTitle(date);

  const booking = data.bookings.find((b) => b.id === openBooking) ?? null;
  const canEdit = (b: CalBooking) => isManager || b.items.every((i) => i.staffId === ownStaffId);
  const staffColor = (id: string) => data.staff.find((s) => s.id === id)?.color ?? "green";
  const [colorBy, setColorBy] = useColorBy();
  // by service: the first service that has its own colour, otherwise the specialist's
  const blockColor = (b: CalBooking, staffId: string) =>
    (colorBy === "service" && b.items.find((i) => i.staffId === staffId && i.serviceColor)?.serviceColor) ||
    staffColor(staffId);
  const weekStaff = weekStaffId ?? ownStaffId ?? data.staff[0]?.id ?? null;

  const handleMove = async (bookingId: string, col: GridColumn, start: Date, durationMin?: number) => {
    const b = data.bookings.find((x) => x.id === bookingId);
    if (b) {
      const length = durationMin
        ? durationMin * 60_000
        : new Date(b.end).getTime() - new Date(b.start).getTime();
      setMoved((m) => ({
        ...m,
        [bookingId]: { staffId: col.staffId, start: start.getTime(), end: start.getTime() + length },
      }));
    }
    const r = await moveBooking({ bookingId, staffId: col.staffId, start: start.toISOString(), durationMin });
    if (r.ok) toast.success(t("booking.moved"));
    else if (r.error === "conflicts" && "conflicts" in r)
      toast.error(r.conflicts.map((c) => t(`booking.conflicts.${c}`)).join(" "));
    else toast.error(t(`errors.${r.error}`));
    if (!r.ok)
      setMoved((m) => {
        const next = { ...m };
        delete next[bookingId];
        return next;
      });
    router.refresh();
  };

  const blocksFor = (columns: GridColumn[]) =>
    data.bookings
      .filter((b) => !HIDDEN_IN_GRID.includes(b.status))
      .flatMap((b) =>
        // one block per staff member involved (multi-service visits can span people)
        [...new Set(b.items.map((i) => i.staffId))].flatMap((sid) => {
          const m = moved[b.id];
          if (m) {
            const col = columns.find(
              (c) => c.staffId === m.staffId && c.date === localDate(new Date(m.start).toISOString(), tz),
            );
            return col && sid === b.items[0].staffId
              ? [
                  {
                    booking: b,
                    columnKey: col.key,
                    start: m.start,
                    end: m.end,
                    color: blockColor(b, m.staffId),
                  },
                ]
              : [];
          }
          const its = b.items.filter((i) => i.staffId === sid);
          const start = Math.min(...its.map((i) => new Date(i.start).getTime()));
          const end = Math.max(...its.map((i) => new Date(i.end).getTime()));
          const col = columns.find(
            (c) => c.staffId === sid && c.date === localDate(new Date(start).toISOString(), tz),
          );
          return col ? [{ booking: b, columnKey: col.key, start, end, color: blockColor(b, sid) }] : [];
        }),
      );

  const grid = (columns: GridColumn[]) => (
    <TimeGrid
      columns={columns}
      blocks={blocksFor(columns)}
      timeZone={tz}
      dayStartMin={data.dayStartMin}
      dayEndMin={data.dayEndMin}
      stepMin={data.slotStepMin}
      working={(c) => data.working[`${c.staffId}|${c.date}`] ?? []}
      timeOff={(c) => data.timeOff[`${c.staffId}|${c.date}`] ?? []}
      canDrag={(b) => canEdit(b) && ["pending", "confirmed", "arrived"].includes(b.status)}
      onEmptyClick={(c, start) =>
        setCreating({ date: c.date, time: localTime(start.toISOString(), tz), staffId: c.staffId })
      }
      onBlockClick={setOpenBooking}
      onMove={handleMove}
    />
  );

  const listDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(date, i)), [date]);

  return (
    <div className="flex flex-col gap-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto min-w-0 text-xl font-semibold text-balance md:text-2xl">{title}</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:size-9"
            aria-label={t("calendar.prev")}
            onClick={() => shift(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            className="h-11 md:h-9"
            disabled={date === today}
            onClick={() => go({ date: today })}
          >
            {t("calendar.today")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11 md:size-9"
            aria-label={t("calendar.next")}
            onClick={() => shift(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        {isDental && view === "day" && (
          <div role="tablist" aria-label={t("calendar.byChair")} className="flex rounded-lg bg-muted p-1">
            {(["staff", "chair"] as const).map((b) => (
              <button
                key={b}
                role="tab"
                aria-selected={dayBy === b}
                onClick={() => go({ by: b })}
                className="min-h-9 rounded-md px-3 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:bg-card aria-selected:font-medium aria-selected:text-foreground aria-selected:shadow-sm"
              >
                {t(b === "staff" ? "calendar.byStaff" : "calendar.byChair")}
              </button>
            ))}
          </div>
        )}
        <div role="tablist" aria-label={t("calendar.title")} className="flex rounded-lg bg-muted p-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => go({ view: v })}
              className="min-h-9 rounded-md px-3 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:bg-card aria-selected:font-medium aria-selected:text-foreground aria-selected:shadow-sm"
            >
              {t(`calendar.views.${v}`)}
            </button>
          ))}
        </div>
        {(view === "day" || view === "week") && (
          <div role="radiogroup" aria-label={t("calendar.colorBy")} className="flex rounded-lg bg-muted p-1">
            {(["staff", "service"] as const).map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={colorBy === c}
                onClick={() => setColorBy(c)}
                className="min-h-9 rounded-md px-3 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:bg-card aria-checked:font-medium aria-checked:text-foreground aria-checked:shadow-sm"
              >
                {t(c === "staff" ? "calendar.colorByStaff" : "calendar.colorByService")}
              </button>
            ))}
          </div>
        )}
        <Button
          variant="outline"
          className="h-11 md:h-9"
          onClick={() => {
            setWaitHighlight([]);
            setFreedBooking(null);
            setWaitOpen(true);
          }}
        >
          {t("waitlist.button", { count: waitlist.length })}
        </Button>
        {isManager && (
          <Button variant="outline" asChild className="h-11 md:h-9">
            <Link href="/calendar/import">
              <Upload aria-hidden />
              {t("bookingImport.open")}
            </Link>
          </Button>
        )}
        <Button
          className="h-11 md:h-9"
          onClick={() => setCreating({ date, time: null, staffId: isManager ? null : ownStaffId })}
        >
          <Plus aria-hidden />
          {t("calendar.newBooking")}
        </Button>
      </div>

      {data.staff.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={<UserRound />}
            title={t("calendar.noStaffTitle")}
            description={t("calendar.noStaffBody")}
            action={
              isManager && (
                <Button asChild className="h-11 md:h-9">
                  <Link href="/staff">{t("staff.new")}</Link>
                </Button>
              )
            }
          />
        </div>
      ) : view === "day" && isDental && dayBy === "chair" ? (
        data.resources.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {t("calendar.noChairs")}
          </p>
        ) : (
          <TimeGrid
            columns={data.resources.map((r) => ({
              key: r.id,
              staffId: "",
              date,
              header: <span className="text-sm font-medium">{r.name}</span>,
            }))}
            blocks={data.bookings
              .filter((b) => !HIDDEN_IN_GRID.includes(b.status))
              .flatMap((b) => {
                const it = b.items.find((i) => i.resourceId);
                if (!it || localDate(it.start, tz) !== date) return [];
                const end = new Date(b.items.at(-1)!.end).getTime();
                return [
                  {
                    booking: b,
                    columnKey: it.resourceId!,
                    start: new Date(it.start).getTime(),
                    end,
                    color: staffColor(it.staffId),
                  },
                ];
              })}
            timeZone={tz}
            dayStartMin={data.dayStartMin}
            dayEndMin={data.dayEndMin}
            stepMin={data.slotStepMin}
            working={(c) => data.opening[c.date] ?? []}
            timeOff={() => []}
            canDrag={() => false}
            onEmptyClick={(c, start) =>
              setCreating({ date: c.date, time: localTime(start.toISOString(), tz), staffId: null })
            }
            onBlockClick={setOpenBooking}
            onMove={handleMove}
          />
        )
      ) : view === "day" ? (
        grid(
          data.staff.map((s) => ({
            key: s.id,
            staffId: s.id,
            date,
            header: (
              <span className="flex items-center gap-2">
                <StaffAvatar name={s.name} color={s.color} photoUrl={s.photoUrl} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{s.name}</span>
                  {s.position && <span className="truncate text-xs text-muted-foreground">{s.position}</span>}
                </span>
              </span>
            ),
          })),
        )
      ) : view === "week" ? (
        <div className="flex flex-col gap-3">
          {isManager && (
            <Select value={weekStaff ?? undefined} onValueChange={(v) => go({ staff: v })}>
              <SelectTrigger aria-label={t("calendar.staffPicker")} className="h-11 w-64 max-w-full md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.staff.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {weekStaff &&
            grid(
              weekDates(date).map((d) => ({
                key: d,
                staffId: weekStaff,
                date: d,
                header: (
                  <button
                    type="button"
                    onClick={() => go({ date: d, view: "day" })}
                    className={cn("text-left text-sm", d === today && "font-semibold text-primary")}
                  >
                    {dates.parts(d).weekdayShort} {dates.parts(d).day}
                  </button>
                ),
              })),
            )}
        </div>
      ) : view === "list" ? (
        <div className="flex flex-col gap-4">
          {listDays.map((d) => {
            const day = data.bookings.filter((b) => localDate(b.start, tz) === d);
            return (
              <section key={d} className="flex flex-col gap-2">
                <h2 className={cn("text-sm font-semibold", d === today && "text-primary")}>
                  {dates.dayTitle(d)}{" "}
                  <span className="font-normal text-muted-foreground">
                    ·{" "}
                    {t("calendar.bookings", {
                      count: day.filter((b) => !HIDDEN_IN_GRID.includes(b.status)).length,
                    })}
                  </span>
                </h2>
                {day.length > 0 && (
                  <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card">
                    {day.map((b) => (
                      <li key={b.id}>
                        <button
                          type="button"
                          onClick={() => setOpenBooking(b.id)}
                          className={cn(
                            "flex w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
                            HIDDEN_IN_GRID.includes(b.status) && "[&_*]:text-muted-foreground", // cancelled: muted, still readable
                          )}
                        >
                          <span className="w-12 shrink-0 text-sm font-semibold tabular-nums">
                            {localTime(b.start, tz)}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                            <span className="flex items-center gap-1.5 text-sm font-medium">
                              {b.client?.name ?? t("calendar.walkIn")}
                              {b.client?.importantNote && (
                                <TriangleAlert
                                  className="size-3.5 text-warning"
                                  aria-label={t("clients.fields.importantNote")}
                                />
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {b.items.map((i) => i.name).join(", ")} ·{" "}
                              {data.staff.find((s) => s.id === b.items[0]?.staffId)?.name}
                            </span>
                          </span>
                          <StatusPill tone={STATUS_TONE[b.status]}>
                            {t(`booking.status.${b.status as "confirmed"}`)}
                          </StatusPill>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-medium text-muted-foreground">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <span key={d} className="py-2">
                {t(`weekdays.short.${d}` as "weekdays.short.1")}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthGrid(date).map((d) => {
              const count = data.bookings.filter(
                (b) => !HIDDEN_IN_GRID.includes(b.status) && localDate(b.start, tz) === d,
              ).length;
              const inMonth = d.slice(0, 7) === date.slice(0, 7);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => go({ date: d, view: "day" })}
                  className={cn(
                    "flex min-h-16 flex-col items-start gap-1 border-t border-l p-1.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset md:min-h-24 md:p-2",
                    !inMonth && "text-muted-foreground/60",
                  )}
                >
                  <span
                    className={cn(
                      "text-sm tabular-nums",
                      d === today &&
                        "flex size-7 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground",
                    )}
                  >
                    {Number(d.slice(8))}
                  </span>
                  {count > 0 && (
                    <StatusPill tone="brand" className="px-1.5 text-[0.7rem] md:px-2.5 md:text-xs">
                      {count}
                    </StatusPill>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(view === "day" || view === "week") && (
        <p className="hidden text-xs text-muted-foreground md:block">{t("calendar.dragHint")}</p>
      )}

      <BookingPanel
        key={booking?.id}
        booking={booking}
        staff={data.staff}
        timeZone={tz}
        canEdit={!!booking && canEdit(booking)}
        isManager={isManager}
        isDental={isDental}
        onClose={() => {
          setOpenBooking(null);
          if (openBookingId) {
            // drop ?booking= so the same link opens the panel again next time
            const p = new URLSearchParams({
              date,
              ...(viewParam && { view: viewParam }),
              ...(weekStaffId && { staff: weekStaffId }),
              ...(dayBy === "chair" && { by: "chair" }),
            });
            router.replace(`${pathname}?${p}`);
          } else router.refresh();
        }}
        onCancelled={async (id) => {
          const matches = await waitlistMatches(id);
          if (matches.length)
            toast(t("waitlist.matches", { count: matches.length }), {
              action: {
                label: t("waitlist.show"),
                onClick: () => {
                  setWaitHighlight(matches);
                  setFreedBooking(id);
                  setWaitOpen(true);
                },
              },
              duration: 15_000,
            });
        }}
      />
      <WaitlistPanel
        open={waitOpen}
        onOpenChange={setWaitOpen}
        entries={waitlist}
        highlight={waitHighlight}
        freedBooking={isManager ? freedBooking : null}
        onBook={(w) => {
          setWaitOpen(false);
          setCreating({
            date: w.dateFrom < today ? today : w.dateFrom,
            time: null,
            staffId: w.staffId,
            fromWaitlist: w,
          });
        }}
      />
      {creating && (
        <NewBookingPanel
          open
          onClose={() => {
            const fromCard = !!creating.forClient;
            setCreating(null);
            // drop ?for= so a reload does not open the form again
            if (fromCard) router.replace(`${pathname}?${new URLSearchParams({ date })}`);
            else router.refresh();
          }}
          initial={creating}
          staff={data.staff}
          catalog={catalog}
          timeZone={tz}
          isManager={isManager}
          ownStaffId={ownStaffId}
          preset={
            creating.fromWaitlist
              ? {
                  client: {
                    id: creating.fromWaitlist.client.id,
                    first_name: creating.fromWaitlist.client.name,
                    last_name: null,
                    phone_e164: creating.fromWaitlist.client.phone,
                    important_note: creating.fromWaitlist.client.importantNote,
                    no_show_count: creating.fromWaitlist.client.noShows,
                  },
                  serviceIds: [creating.fromWaitlist.serviceId],
                }
              : creating.forClient
                ? { client: creating.forClient, serviceIds: [] }
                : undefined
          }
          onCreated={(id) => {
            if (creating.fromWaitlist) void setWaitlistStatus(creating.fromWaitlist.id, "booked", id);
          }}
        />
      )}
    </div>
  );
}
