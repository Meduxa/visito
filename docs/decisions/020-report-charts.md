# 020 — Reports: tabs, chart/table switch, comparison; charts with shadcn chart (Recharts)

**Context.** Levan compared our Reports page with a competitor (2026-11-07). They have the same data split into sections, with a chart/table switch on each card and a "compare" option. Our page was one long list of simple bars.

**Decision.**
- Reports is split into tabs: Overview, Revenue, Payments, Services, Clients, Specialists. Each tab is its own link (`?tab=`) next to `from`, `to`, `staff` and `compare`, so the server renders one tab and links keep the view. Revenue and Payments are hidden when the person may not see money (`can_see_money`).
- Charts use the **shadcn chart component on Recharts** (Levan chose it over hand-drawn SVG). Colours are the `--chart-*` tokens. Recharts loads only on the Reports page (client component `report-chart.tsx`). Ranked lists (services, specialists, categories) keep the simple bar list, which reads better on a phone than a chart with long labels.
- Charts over time use days for periods up to 62 days and months for longer ones. Every day or month is present, including empty ones.
- **Comparison** with the previous period of the same length, or the same dates a year earlier (29 Feb → 28 Feb). It is computed by running the same report a second time, so it obeys RLS exactly like the main one. Points line up by position (day 1 with day 1). Rates change in percentage points; other numbers in %.
- No profit & loss until expenses are recorded somewhere (a later expenses module).

**Consequences.** With comparison on, the page loads the report twice, which takes about twice as long; it is off by default. A new chart is one `<ReportChart>` with rows and measures.
