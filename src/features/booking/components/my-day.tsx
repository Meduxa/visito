"use client";

import { CalendarCheck, CalendarDays, CheckCheck, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { useRouter } from "@/i18n/navigation";
import { useDates } from "@/lib/use-dates";
import { cn } from "@/lib/utils";
import type { CalBooking, CalStaff } from "../queries";
import { BookingPanel, STATUS_TONE } from "./booking-panel";
import { noClientKey } from "../client-label";

const GONE = ["cancelled_by_client", "cancelled_by_business"];

export function MyDay({
  bookings,
  me,
  today,
  timeZone,
  isDental,
}: {
  bookings: CalBooking[];
  me: CalStaff;
  today: string;
  timeZone: string;
  isDental: boolean;
}) {
  const t = useTranslations();
  const dates = useDates();
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const day = (b: CalBooking) => new Date(b.start).toLocaleDateString("en-CA", { timeZone });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" });

  const live = bookings.filter((b) => !GONE.includes(b.status));
  const todays = live.filter((b) => day(b) === today);
  const current = todays.find((b) => new Date(b.start).getTime() <= now && now < new Date(b.end).getTime());
  const next = live.find((b) => new Date(b.start).getTime() > now);
  const upcoming = live.filter((b) => day(b) > today);
  const past = live
    .filter((b) => new Date(b.end).getTime() < now && day(b) < today)
    .reverse()
    .slice(0, 20);

  const row = (b: CalBooking, highlight = false) => (
    <li key={b.id}>
      <button
        type="button"
        onClick={() => setOpen(b.id)}
        className={cn(
          "flex w-full items-start gap-3 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          highlight && "bg-accent/60",
        )}
      >
        <span className="w-24 shrink-0 text-sm font-semibold tabular-nums">
          {day(b) !== today && (
            <span className="block text-xs font-normal text-muted-foreground">{dates.dayShort(day(b))}</span>
          )}
          {time(b.start)}–{time(b.end)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            {b.client?.name ?? t(noClientKey(b))}
            {b.client?.importantNote && (
              <TriangleAlert
                className="size-3.5 text-warning"
                aria-label={t("clients.fields.importantNote")}
              />
            )}
          </span>
          <span className="text-xs text-muted-foreground">{b.items.map((i) => i.name).join(", ")}</span>
        </span>
        <StatusPill tone={STATUS_TONE[b.status]}>{t(`booking.status.${b.status as "confirmed"}`)}</StatusPill>
      </button>
    </li>
  );
  const section = (title: string, list: CalBooking[], empty?: string) => (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {list.length ? (
        <ul className="divide-y overflow-hidden rounded-xl border bg-card">
          {list.map((b) => row(b, b.id === current?.id))}
        </ul>
      ) : (
        empty && <p className="text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader title={t("myDay.title")} description={`${me.name} · ${dates.dayTitle(today)}`} />

      {/* three in a row, small, also on a phone: today's visits stay on the first screen (#45) */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard compact icon={<CalendarDays />} label={t("myDay.stats.today")} value={todays.length} />
        <StatCard
          compact
          icon={<CalendarCheck />}
          tone="info"
          label={t("myDay.stats.week")}
          value={
            live.filter((b) => {
              const s = new Date(b.start).getTime();
              return s >= now && s < now + 7 * 86_400_000;
            }).length
          }
        />
        <StatCard
          compact
          icon={<CheckCheck />}
          tone="warning"
          label={t("myDay.stats.completed")}
          value={bookings.filter((b) => b.status === "completed").length /* data covers the last 30 days */}
        />
      </div>

      {(current || next) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {current && (
            <button
              type="button"
              onClick={() => setOpen(current.id)}
              className="flex flex-col gap-1 rounded-xl border-2 border-primary bg-card p-4 text-left"
            >
              <span className="text-xs font-medium text-primary">{t("myDay.now")}</span>
              <span className="font-semibold">{current.client?.name ?? t(noClientKey(current))}</span>
              <span className="text-sm text-muted-foreground">
                {time(current.start)}–{time(current.end)} · {current.items.map((i) => i.name).join(", ")}
              </span>
            </button>
          )}
          {next && (
            <button
              type="button"
              onClick={() => setOpen(next.id)}
              className="flex flex-col gap-1 rounded-xl border bg-card p-4 text-left"
            >
              <span className="text-xs font-medium text-muted-foreground">
                {t("myDay.nextUp")}
                {day(next) === today &&
                  ` · ${t("myDay.inMinutes", { minutes: Math.max(0, Math.round((new Date(next.start).getTime() - now) / 60_000)) })}`}
              </span>
              <span className="font-semibold">{next.client?.name ?? t(noClientKey(next))}</span>
              <span className="text-sm text-muted-foreground">
                {day(next) !== today && `${dates.dayShort(day(next))} · `}
                {time(next.start)} · {next.items.map((i) => i.name).join(", ")}
              </span>
            </button>
          )}
        </div>
      )}

      {section(t("myDay.today"), todays, t("calendar.emptyDay"))}
      {section(t("myDay.upcoming"), upcoming)}
      {section(t("myDay.past"), past)}

      <BookingPanel
        key={open ?? "none"}
        booking={bookings.find((b) => b.id === open) ?? null}
        staff={[me]}
        timeZone={timeZone}
        canEdit
        isManager={false}
        isDental={isDental}
        onClose={() => {
          setOpen(null);
          router.refresh();
        }}
      />
    </div>
  );
}
