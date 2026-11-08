import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CalendarCheck,
  Coins,
  Download,
  Gauge,
  Receipt,
  UserPlus,
  Users,
  UserX,
  XCircle,
} from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { type ChartRow, ReportChart } from "@/features/reports/components/report-chart";
import type { Report } from "@/features/reports/compute";
import {
  changePct,
  COMPARE_MODES,
  comparisonRange,
  type ReportTab,
  REPORT_TABS,
  reportParams,
  shiftDays,
} from "@/features/reports/params";
import { buildReport, canSeeMoney } from "@/features/reports/report";
import { Link } from "@/i18n/navigation";
import { fullDate, ymdIn } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/[locale]/reports">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "reports" });
  return { title: t("title") };
}

const pct = (v: number | null) => (v === null ? "—" : `${v}%`);
const hours = (min: number) => (Math.round((min / 60) * 10) / 10).toString();
const MONEY_TABS: ReportTab[] = ["revenue", "payments"];

function Kpis({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

function Section({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  return (
    <Card className={`gap-4 p-4 md:p-6 ${wide ? "lg:col-span-2" : ""}`}>
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

/** "+12% vs previous period" under a number; green when it moved the good way. */
function Delta({
  now,
  before,
  points,
  lowerIsBetter,
  vs,
  pointsLabel,
}: {
  now: number | null;
  before: number | null;
  /** rates: show the difference in percentage points, not % of % */
  points?: boolean;
  lowerIsBetter?: boolean;
  vs: string;
  pointsLabel: (v: string) => string;
}) {
  const c = points
    ? now === null || before === null
      ? null
      : Math.round((now - before) * 10) / 10
    : changePct(now, before);
  if (c === null) return <p className="text-xs text-muted-foreground">— {vs}</p>;
  const good = c === 0 ? null : c > 0 !== !!lowerIsBetter;
  const text = `${c > 0 ? "+" : ""}${c}`;
  const Icon = c >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <p
      className={cn(
        "flex items-center gap-1 text-xs",
        good === null ? "text-muted-foreground" : good ? "text-success-ink" : "text-destructive-ink",
      )}
      data-testid="report-delta"
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="font-medium tabular-nums">{points ? pointsLabel(text) : `${text}%`}</span>
      <span className="text-muted-foreground">{vs}</span>
    </p>
  );
}

export default async function ReportsPage({ params, searchParams }: PageProps<"/[locale]/reports">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  const t = await getTranslations();
  const L = (k: string, v?: Record<string, string | number>) => t(`reports.${k}` as "reports.title", v);
  const db = await createClient();
  const { data: tz } = await db.from("tenants").select("timezone").eq("id", tenant.tenantId).single();
  const today = ymdIn(new Date().toISOString(), tz?.timezone);
  const { from, to, staff, compare, tab: asked } = reportParams(await searchParams, today);
  const prevRange = comparisonRange(from, to, compare);
  const [r, prev, money, { data: staffList }] = await Promise.all([
    buildReport(db, tenant.tenantId, { from, to, staffId: staff, locale }),
    prevRange ? buildReport(db, tenant.tenantId, { ...prevRange, staffId: staff, locale }) : null,
    canSeeMoney(db, tenant.tenantId, tenant.role),
    db.from("staff").select("id, display_name").eq("tenant_id", tenant.tenantId).order("sort_order"),
  ]);
  const tabs = REPORT_TABS.filter((k) => money || !MONEY_TABS.includes(k));
  const tab = tabs.includes(asked) ? asked : "overview";

  // ----- links -----
  const monthStart = `${today.slice(0, 8)}01`;
  const lastMonthEnd = shiftDays(monthStart, -1);
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const presets = [
    { key: "today", from: today, to: today },
    { key: "thisWeek", from: shiftDays(today, -weekday), to: today },
    { key: "thisMonth", from: monthStart, to: today },
    { key: "lastMonth", from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd },
    { key: "last30", from: shiftDays(today, -29), to: today },
    { key: "thisYear", from: `${today.slice(0, 4)}-01-01`, to: today },
  ];
  const href = (o: { from?: string; to?: string; tab?: string }) => {
    const q = new URLSearchParams({ from: o.from ?? from, to: o.to ?? to });
    if (staff) q.set("staff", staff);
    if (compare !== "off") q.set("compare", compare);
    if ((o.tab ?? tab) !== "overview") q.set("tab", o.tab ?? tab);
    return `/reports?${q}`;
  };
  const exportHref = `/api/export/report?from=${from}&to=${to}${staff ? `&staff=${staff}` : ""}&locale=${locale}`;

  // ----- comparison helpers -----
  const vs = prev ? L(`compareVs.${compare}`) : "";
  const delta = (
    pick: (x: Report) => number | null,
    o: { points?: boolean; lowerIsBetter?: boolean } = {},
  ) =>
    prev ? (
      <Delta
        now={pick(r)}
        before={pick(prev)}
        vs={vs}
        pointsLabel={(v) => L("points", { value: v })}
        {...o}
      />
    ) : undefined;
  const compareLabel = prev ? L(`compareModes.${compare}`) : undefined;

  // ----- rows for the charts -----
  const month = (n: string) => t(`dates.monthsShort.${Number(n)}` as "dates.monthsShort.1");
  const longMonth = (n: string) => t(`dates.monthTitle.${Number(n)}` as "dates.monthTitle.1");
  const spansYears = from.slice(0, 4) !== to.slice(0, 4);
  const overTime: ChartRow[] = r.series.map((s, i) => {
    const before = prev?.series[i];
    const isMonth = r.bucket === "month";
    return {
      label: isMonth
        ? `${month(s.key.slice(5, 7))}${spansYears ? ` ${s.key.slice(2, 4)}` : ""}`
        : `${Number(s.key.slice(8))} ${month(s.key.slice(5, 7))}`,
      title: isMonth ? `${longMonth(s.key.slice(5, 7))} ${s.key.slice(0, 4)}` : fullDate(t, s.key),
      values: {
        received: money ? s.receivedMinor : null,
        bookings: s.bookings,
        ...(before && {
          "prev:received": money ? before.receivedMinor : null,
          "prev:bookings": before.bookings,
        }),
        ...Object.fromEntries(r.money.byMethod.map((m) => [m.method, s.byMethod[m.method] ?? 0])),
      },
    };
  });
  const overTimeMetrics = [
    ...(money ? [{ key: "received", label: L("metrics.revenue"), fmt: "money" as const }] : []),
    { key: "bookings", label: L("metrics.bookings"), fmt: "count" as const },
  ];
  const overTimeSubtitle = L(r.bucket === "month" ? "byMonth" : "byDayShort");
  const methodLabel = (m: string) => t(`checkout.methods.${m}` as "checkout.methods.cash");

  const kpis = {
    received: money && (
      <StatCard
        key="received"
        icon={<Banknote />}
        label={L("received")}
        value={formatMoney(r.money.receivedMinor)}
        hint={L("tipsHint", { tips: formatMoney(r.money.tipsMinor) })}
        extra={delta((x) => x.money.receivedMinor)}
      />
    ),
    ticket: money && (
      <StatCard
        key="ticket"
        icon={<Receipt />}
        label={L("averageTicket")}
        value={r.money.averageTicketMinor === null ? "—" : formatMoney(r.money.averageTicketMinor)}
        extra={delta((x) => x.money.averageTicketMinor)}
      />
    ),
    visits: (
      <StatCard
        key="visits"
        icon={<CalendarCheck />}
        label={L("visitsCompleted")}
        value={r.bookings.completed}
        hint={L("ofBookings", { count: r.bookings.total })}
        extra={delta((x) => x.bookings.completed)}
      />
    ),
    occupancy: (
      <StatCard
        key="occupancy"
        icon={<Gauge />}
        label={L("occupancy")}
        value={pct(r.occupancyPct)}
        extra={delta((x) => x.occupancyPct, { points: true })}
      />
    ),
    noShow: (
      <StatCard
        key="noShow"
        icon={<UserX />}
        label={L("noShowRate")}
        value={pct(r.bookings.noShowRatePct)}
        tone="danger"
        extra={delta((x) => x.bookings.noShowRatePct, { points: true, lowerIsBetter: true })}
      />
    ),
    cancelled: (
      <StatCard
        key="cancelled"
        icon={<XCircle />}
        label={L("cancellationRate")}
        value={pct(r.bookings.cancellationRatePct)}
        tone="warning"
        extra={delta((x) => x.bookings.cancellationRatePct, { points: true, lowerIsBetter: true })}
      />
    ),
    newClients: (
      <StatCard
        key="newClients"
        icon={<UserPlus />}
        label={L("newClients")}
        value={r.clients.new}
        hint={L("returningHint", { count: r.clients.returning })}
        extra={delta((x) => x.clients.new)}
      />
    ),
    clients: (
      <StatCard
        key="clients"
        icon={<Users />}
        label={L("clientsSeen")}
        value={r.clients.seen}
        extra={delta((x) => x.clients.seen)}
      />
    ),
    returning: (
      <StatCard
        key="returning"
        icon={<Users />}
        label={L("returningClients")}
        value={r.clients.returning}
        extra={delta((x) => x.clients.returning)}
      />
    ),
    tips: money && (
      <StatCard
        key="tips"
        icon={<Coins />}
        label={L("tips")}
        value={formatMoney(r.money.tipsMinor)}
        extra={delta((x) => x.money.tipsMinor)}
      />
    ),
  };

  const overTimeChart = (
    <ReportChart
      title={L(money ? "overTime" : "overTimeBookings")}
      subtitle={overTimeSubtitle}
      metrics={overTimeMetrics}
      rows={overTime}
      shape="columns"
      compareLabel={compareLabel}
      firstColumn={L(r.bucket === "month" ? "month" : "date")}
      wide
      testId="chart-over-time"
    />
  );
  const categoryChart = (
    <ReportChart
      title={L("categories")}
      subtitle={L("completedHint")}
      metrics={[
        ...(money ? [{ key: "value", label: L("metrics.revenue"), fmt: "money" as const }] : []),
        { key: "count", label: L("metrics.count"), fmt: "count" as const },
      ]}
      rows={r.money.byCategory.map((c) => ({
        label: c.name || L("noCategory"),
        values: { value: money ? c.minor : null, count: c.count },
      }))}
      shape="list"
      firstColumn={L("category")}
    />
  );
  const serviceMetrics = [
    ...(money ? [{ key: "value", label: L("metrics.revenue"), fmt: "money" as const }] : []),
    { key: "count", label: L("metrics.count"), fmt: "count" as const },
  ];
  const serviceRows = (list: Report["services"]) =>
    list.map((s) => ({ label: s.name, values: { value: money ? s.valueMinor : null, count: s.count } }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={L("title")}
        description={`${fullDate(t, from)} — ${fullDate(t, to)}${
          prevRange ? ` · ${compareLabel}: ${fullDate(t, prevRange.from)} — ${fullDate(t, prevRange.to)}` : ""
        }`}
        actions={
          <Button asChild variant="outline" className="h-11 md:h-9">
            <a href={exportHref} download>
              <Download aria-hidden />
              {L("excel")}
            </a>
          </Button>
        }
      />

      <Card className="gap-3 p-4">
        <nav aria-label={L("period")} className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <Link
              key={p.key}
              href={href(p)}
              aria-current={p.from === from && p.to === to ? "page" : undefined}
              className="flex min-h-9 items-center rounded-full border px-3 text-sm hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground"
            >
              {L(`presets.${p.key}`)}
            </Link>
          ))}
        </nav>
        <form method="get" className="flex flex-wrap items-end gap-3">
          {tab !== "overview" && <input type="hidden" name="tab" value={tab} />}
          <label className="flex flex-col gap-1 text-sm">
            {L("from")}
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="h-11 rounded-lg border bg-background px-3 md:h-9"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {L("to")}
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="h-11 rounded-lg border bg-background px-3 md:h-9"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {L("staff")}
            <select
              name="staff"
              defaultValue={staff ?? ""}
              className="h-11 rounded-lg border bg-background px-3 md:h-9"
            >
              <option value="">{L("allStaff")}</option>
              {(staffList ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            {L("compare")}
            <select
              name="compare"
              defaultValue={compare}
              className="h-11 rounded-lg border bg-background px-3 md:h-9"
            >
              {COMPARE_MODES.map((m) => (
                <option key={m} value={m}>
                  {L(`compareModes.${m}`)}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="h-11 md:h-9">
            {L("show")}
          </Button>
        </form>
      </Card>

      <nav aria-label={L("sections")} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
        <ul className="flex min-w-max gap-1 border-b">
          {tabs.map((k) => (
            <li key={k}>
              <Link
                href={href({ tab: k })}
                aria-current={k === tab ? "page" : undefined}
                className="-mb-px flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm text-muted-foreground hover:text-foreground aria-[current=page]:border-primary aria-[current=page]:font-medium aria-[current=page]:text-foreground md:min-h-9"
              >
                {L(`tabs.${k}`)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "overview" && (
        <>
          <Kpis>
            {kpis.received}
            {kpis.ticket}
            {kpis.visits}
            {kpis.occupancy}
            {kpis.noShow}
            {kpis.cancelled}
            {kpis.newClients}
          </Kpis>
          <div className="grid gap-6 lg:grid-cols-2">{overTimeChart}</div>
        </>
      )}

      {tab === "revenue" && (
        <>
          <Kpis>
            {kpis.received}
            {kpis.ticket}
            {kpis.tips}
            {kpis.visits}
          </Kpis>
          <div className="grid gap-6 lg:grid-cols-2">
            {overTimeChart}
            {categoryChart}
            <ReportChart
              title={L("byStaff")}
              subtitle={L("completedHint")}
              metrics={[{ key: "value", label: L("serviceValue"), fmt: "money" }]}
              rows={r.staff.map((s) => ({ label: s.name, values: { value: s.valueMinor } }))}
              shape="list"
              firstColumn={L("staff")}
            />
          </div>
        </>
      )}

      {tab === "payments" && (
        <>
          <Kpis>
            {kpis.received}
            {kpis.tips}
            {r.money.byMethod.map((m) => (
              <StatCard
                key={m.method}
                icon={<Banknote />}
                label={methodLabel(m.method)}
                value={formatMoney(m.minor)}
                hint={L("tipsHint", { tips: formatMoney(m.tipsMinor) })}
              />
            ))}
          </Kpis>
          <div className="grid gap-6 lg:grid-cols-2">
            <ReportChart
              title={L("byMethodOverTime")}
              subtitle={overTimeSubtitle}
              metrics={r.money.byMethod.map((m) => ({
                key: m.method,
                label: methodLabel(m.method),
                fmt: "money" as const,
              }))}
              rows={overTime}
              shape="columns"
              stacked
              firstColumn={L(r.bucket === "month" ? "month" : "date")}
              wide
              testId="chart-methods"
            />
          </div>
        </>
      )}

      {tab === "services" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ReportChart
            title={L("topServices")}
            subtitle={L("top10")}
            metrics={serviceMetrics}
            rows={serviceRows(r.topServices)}
            shape="list"
            firstColumn={L("service")}
          />
          {categoryChart}
          <ReportChart
            title={L("allServices")}
            subtitle={L("completedHint")}
            metrics={serviceMetrics}
            rows={serviceRows(r.services)}
            shape="list"
            firstColumn={L("service")}
            defaultView="table"
            wide
          />
        </div>
      )}

      {tab === "clients" && (
        <>
          <Kpis>
            {kpis.clients}
            {kpis.newClients}
            {kpis.returning}
          </Kpis>
          <div className="grid gap-6 lg:grid-cols-2">
            <Section title={L("retentionTitle")}>
              <p className="text-sm text-muted-foreground">{L("retentionHint")}</p>
              <dl className="grid grid-cols-3 gap-3 text-center">
                {(["d30", "d60", "d90"] as const).map((k) => (
                  <div key={k} className="rounded-lg bg-muted/60 p-3">
                    <dt className="text-xs text-muted-foreground">{L(`retention.${k}`)}</dt>
                    <dd className="text-xl font-semibold tabular-nums">{pct(r.clients.retentionPct[k])}</dd>
                  </div>
                ))}
              </dl>
            </Section>
            <ReportChart
              title={L("sourcesTitle")}
              metrics={[{ key: "count", label: L("metrics.bookings"), fmt: "count" }]}
              rows={Object.entries(r.bookings.bySource).map(([k, v]) => ({
                label: t(`booking.sources.${k}` as "booking.sources.admin"),
                values: { count: v },
              }))}
              shape="list"
              firstColumn={L("source")}
            />
            <ReportChart
              title={L("statusTitle")}
              metrics={[{ key: "count", label: L("metrics.bookings"), fmt: "count" }]}
              rows={Object.entries(r.bookings.byStatus).map(([k, v]) => ({
                label: t(`booking.status.${k}` as "booking.status.confirmed"),
                values: { count: v },
              }))}
              shape="list"
              firstColumn={L("status")}
            />
          </div>
        </>
      )}

      {tab === "staff" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ReportChart
            title={L("byStaff")}
            metrics={[
              ...(money ? [{ key: "value", label: L("serviceValue"), fmt: "money" as const }] : []),
              { key: "occupancy", label: L("occupancy"), fmt: "pct" as const },
              { key: "booked", label: L("bookedHoursShort"), fmt: "hours" as const },
            ]}
            rows={r.staff.map((s) => ({
              label: s.name,
              values: {
                value: money ? s.valueMinor : null,
                occupancy: s.occupancyPct,
                booked: s.bookedMinutes,
              },
            }))}
            shape="list"
            firstColumn={L("staff")}
            wide
            testId="chart-staff"
          />
          <Section title={L("staffTitle")} wide>
            <div
              tabIndex={0}
              role="region"
              aria-label={L("staffTitle")}
              className="overflow-x-auto rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <table className="w-full text-sm" data-testid="staff-table">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-3 font-medium">{L("staff")}</th>
                    {money && <th className="py-2 pr-3 text-right font-medium">{L("serviceValue")}</th>}
                    {money && <th className="py-2 pr-3 text-right font-medium">{L("commission")}</th>}
                    <th className="py-2 pr-3 text-right font-medium">{L("bookedHours")}</th>
                    <th className="py-2 text-right font-medium">{L("occupancy")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {r.staff.map((s) => (
                    <tr key={s.id}>
                      <td className="py-2 pr-3">{s.name}</td>
                      {money && (
                        <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(s.valueMinor)}</td>
                      )}
                      {money && (
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatMoney(s.commissionMinor)}
                        </td>
                      )}
                      <td className="py-2 pr-3 text-right tabular-nums">
                        {hours(s.bookedMinutes)} / {hours(s.workingMinutes)}
                      </td>
                      <td className="py-2 text-right tabular-nums">{pct(s.occupancyPct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {money && <p className="text-xs text-muted-foreground">{L("serviceValueHint")}</p>}
          </Section>
        </div>
      )}
    </div>
  );
}
