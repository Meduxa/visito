"use client";

// One report card with a chart/table switch and, when it has several measures
// (revenue / bookings…), a switch between them. "columns" draws bars over time
// (Recharts via shadcn chart), "list" a ranked list of bars (services, staff…).
// With a comparison, rows carry `prev:<key>` values drawn as faded bars.
import { BarChart3, Table2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export type Fmt = "money" | "count" | "pct" | "hours";
export type ChartMetric = { key: string; label: string; fmt: Fmt };
export type ChartRow = {
  label: string; // axis / list label
  title?: string; // longer label for the tooltip and the table
  values: Record<string, number | null>;
};

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const PREV = "var(--muted-foreground)";

export function formatValue(v: number | null | undefined, fmt: Fmt) {
  if (v === null || v === undefined) return "—";
  if (fmt === "money") return formatMoney(Math.round(v));
  if (fmt === "pct") return `${v}%`;
  if (fmt === "hours") return String(Math.round((v / 60) * 10) / 10);
  return String(v);
}
// axis ticks: whole lari, no tetri
const tick = (v: number, fmt: Fmt) =>
  fmt === "money" ? formatMoney(Math.round(v / 100) * 100) : formatValue(v, fmt);

function change(now: number | null | undefined, before: number | null | undefined) {
  if (now == null || before == null || before === 0) return "—";
  const c = Math.round(((now - before) / Math.abs(before)) * 1000) / 10;
  return `${c > 0 ? "+" : ""}${c}%`;
}

export function ReportChart({
  title,
  subtitle,
  metrics,
  rows,
  shape,
  stacked = false,
  compareLabel,
  firstColumn,
  defaultView = "chart",
  wide = false,
  footer,
  testId,
}: {
  title: string;
  subtitle?: string;
  metrics: ChartMetric[];
  rows: ChartRow[];
  shape: "columns" | "list";
  /** draw every measure at once, stacked (payment methods); no measure switch */
  stacked?: boolean;
  /** legend text of the faded comparison bars; rows then carry `prev:<key>` */
  compareLabel?: string;
  firstColumn: string;
  defaultView?: "chart" | "table";
  wide?: boolean;
  footer?: ReactNode;
  testId?: string;
}) {
  const t = useTranslations("reports");
  const [view, setView] = useState(defaultView);
  const [metricKey, setMetricKey] = useState(metrics[0]?.key ?? "");
  const metric = metrics.find((m) => m.key === metricKey) ?? metrics[0];
  const shown = stacked ? metrics : metric ? [metric] : [];
  const empty = rows.every((r) => shown.every((m) => !r.values[m.key]));
  const titleId = useId();

  return (
    <Card
      className={cn("gap-4 p-4 md:p-6", wide && "lg:col-span-2")}
      data-testid={testId}
      aria-labelledby={titleId}
      role="region"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!stacked && metrics.length > 1 && (
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={metric?.key}
              onValueChange={(v) => v && setMetricKey(v)}
              aria-label={t("view.measure")}
            >
              {metrics.map((m) => (
                <ToggleGroupItem key={m.key} value={m.key} className="h-10 px-3 md:h-8">
                  {m.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            spacing={0}
            value={view}
            onValueChange={(v) => v && setView(v as "chart" | "table")}
            aria-label={t("view.label")}
          >
            <ToggleGroupItem value="chart" aria-label={t("view.chart")} className="size-10 md:size-8">
              <BarChart3 aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label={t("view.table")} className="size-10 md:size-8">
              <Table2 aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {rows.length === 0 || (empty && view === "chart") ? (
        <p className="text-sm text-muted-foreground">{t("nothing")}</p>
      ) : view === "table" ? (
        <DataTable rows={rows} metrics={metrics} firstColumn={firstColumn} compare={!!compareLabel} />
      ) : shape === "columns" ? (
        <Columns rows={rows} metrics={shown} stacked={stacked} compareLabel={compareLabel} />
      ) : (
        <List rows={rows} metric={shown[0]!} />
      )}
      {footer}
    </Card>
  );
}

function Columns({
  rows,
  metrics,
  stacked,
  compareLabel,
}: {
  rows: ChartRow[];
  metrics: ChartMetric[];
  stacked: boolean;
  compareLabel?: string;
}) {
  const fmt = metrics[0]!.fmt;
  const data = rows.map((r) => ({ label: r.label, title: r.title ?? r.label, ...r.values }));
  const config: ChartConfig = Object.fromEntries(
    metrics.map((m, i) => [
      m.key,
      { label: m.label, color: stacked ? COLORS[i % COLORS.length] : COLORS[0] },
    ]),
  );
  const series = [
    ...(compareLabel && !stacked
      ? [{ key: `prev:${metrics[0]!.key}`, label: compareLabel, color: PREV, faded: true }]
      : []),
    ...metrics.map((m, i) => ({
      key: m.key,
      label: m.label,
      color: stacked ? COLORS[i % COLORS.length]! : COLORS[0]!,
      faded: false,
    })),
  ];
  const legend = stacked || compareLabel;

  return (
    <div className="flex flex-col gap-3">
      <ChartContainer config={config} className="aspect-auto h-64 w-full">
        <BarChart data={data} margin={{ left: 4, right: 4, top: 8 }} accessibilityLayer>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={12} tickMargin={8} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={fmt === "money" ? 64 : 32}
            allowDecimals={fmt !== "count"}
            tickFormatter={(v: number) => tick(v, fmt)}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              const p = payload?.[0]?.payload as { title: string } | undefined;
              if (!active || !p) return null;
              return (
                <div className="grid min-w-36 gap-1.5 rounded-lg border bg-background px-2.5 py-1.5 text-xs shadow-xl">
                  <div className="font-medium">{p.title}</div>
                  {series.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span
                        className={cn("size-2.5 shrink-0 rounded-[2px]", s.faded && "opacity-40")}
                        style={{ background: s.color }}
                      />
                      <span className="flex-1 text-muted-foreground">{s.label}</span>
                      <span className="font-medium tabular-nums">
                        {formatValue((p as unknown as Record<string, number | null>)[s.key], fmt)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            }}
          />
          {series.map((s) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color}
              fillOpacity={s.faded ? 0.35 : 1}
              stackId={stacked ? "all" : undefined}
              radius={stacked ? 0 : [4, 4, 0, 0]}
              maxBarSize={40}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartContainer>
      {legend && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className={cn("size-2.5 rounded-[2px]", s.faded && "opacity-40")}
                style={{ background: s.color }}
                aria-hidden
              />
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function List({ rows, metric }: { rows: ChartRow[]; metric: ChartMetric }) {
  const sorted = [...rows].sort((a, b) => (b.values[metric.key] ?? 0) - (a.values[metric.key] ?? 0));
  const max = Math.max(1, ...sorted.map((r) => r.values[metric.key] ?? 0));
  return (
    <ul className="flex flex-col gap-2">
      {sorted.map((r) => (
        <li
          key={r.title ?? r.label}
          className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm"
        >
          <span className="truncate" title={r.title ?? r.label}>
            {r.label}
          </span>
          <span className="h-2 rounded-full bg-muted" aria-hidden>
            <span
              className="block h-2 rounded-full bg-primary"
              style={{ width: `${((r.values[metric.key] ?? 0) / max) * 100}%` }}
            />
          </span>
          <span className="tabular-nums">{formatValue(r.values[metric.key], metric.fmt)}</span>
        </li>
      ))}
    </ul>
  );
}

function DataTable({
  rows,
  metrics,
  firstColumn,
  compare,
}: {
  rows: ChartRow[];
  metrics: ChartMetric[];
  firstColumn: string;
  compare: boolean;
}) {
  const t = useTranslations("reports");
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={firstColumn}
      className="max-h-96 overflow-auto rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card text-left text-muted-foreground">
          <tr>
            <th className="py-2 pr-3 font-medium">{firstColumn}</th>
            {metrics.map((m) => (
              <th key={m.key} className="py-2 pr-3 text-right font-medium" colSpan={compare ? 3 : 1}>
                {m.label}
              </th>
            ))}
          </tr>
          {compare && (
            <tr className="text-xs">
              <th />
              {metrics.map((m) => (
                <MetricSubHeads
                  key={m.key}
                  now={t("view.now")}
                  before={t("view.before")}
                  diff={t("view.change")}
                />
              ))}
            </tr>
          )}
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.title ?? r.label}>
              <td className="py-2 pr-3">{r.title ?? r.label}</td>
              {metrics.map((m) =>
                compare ? (
                  <MetricCells
                    key={m.key}
                    now={r.values[m.key]}
                    before={r.values[`prev:${m.key}`]}
                    fmt={m.fmt}
                  />
                ) : (
                  <td key={m.key} className="py-2 pr-3 text-right tabular-nums">
                    {formatValue(r.values[m.key], m.fmt)}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MetricSubHeads({ now, before, diff }: { now: string; before: string; diff: string }) {
  return (
    <>
      <th className="pr-3 pb-2 text-right font-normal">{now}</th>
      <th className="pr-3 pb-2 text-right font-normal">{before}</th>
      <th className="pr-3 pb-2 text-right font-normal">{diff}</th>
    </>
  );
}

function MetricCells({ now, before, fmt }: { now?: number | null; before?: number | null; fmt: Fmt }) {
  return (
    <>
      <td className="py-2 pr-3 text-right tabular-nums">{formatValue(now, fmt)}</td>
      <td className="py-2 pr-3 text-right text-muted-foreground tabular-nums">{formatValue(before, fmt)}</td>
      <td className="py-2 pr-3 text-right tabular-nums">{change(now, before)}</td>
    </>
  );
}
