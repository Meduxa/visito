"use client";

import { useTranslations } from "next-intl";
import { StatusPill, type PillTone } from "@/components/status-pill";
import { fullDate, shortDate, ymdIn } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import type { ClientRow } from "../queries";
import type { Segment } from "../schema";

// Colours of the automatic groups (decision 024). The name is always written
// out, so colour never carries the meaning alone.
export const SEGMENT_TONE: Record<Segment, PillTone> = {
  new: "info",
  regular: "success",
  vip: "brand",
  at_risk: "warning",
  lost: "danger",
};

export function SegmentPill({ segment }: { segment: Segment }) {
  const t = useTranslations("clients.segments");
  return <StatusPill tone={SEGMENT_TONE[segment]}>{t(segment)}</StatusPill>;
}

/** "26 ოქტომბერი" this year, "26 ოქტომბერი 2025" other years; "—" when there is none. */
export function useVisitDate(timeZone: string) {
  const t = useTranslations();
  const year = new Date().getFullYear().toString();
  return (iso: string | null) => {
    if (!iso) return "—";
    const ymd = ymdIn(iso, timeZone);
    return ymd.startsWith(year) ? shortDate(t, ymd) : fullDate(t, ymd);
  };
}

// The number tiles at the top of the client card.
export function ClientStats({
  client,
  canSeeMoney,
  timeZone,
}: {
  client: ClientRow;
  canSeeMoney: boolean;
  timeZone: string;
}) {
  const t = useTranslations("clients.stats");
  const date = useVisitDate(timeZone);
  const tiles: [string, string][] = [
    [t("visits"), String(client.visits)],
    ...(canSeeMoney
      ? ([
          [t("spent"), formatMoney(client.spentMinor ?? 0)],
          [t("average"), client.averageMinor === null ? "—" : formatMoney(client.averageMinor)],
        ] as [string, string][])
      : []),
    [t("lastVisit"), date(client.lastVisitAt)],
    [t("nextVisit"), date(client.nextVisitAt)],
    [t("noShows"), String(client.noShowCount)],
    [t("cancellations"), String(client.cancellations)],
    [t("since"), date(client.since)],
  ];
  return (
    <section aria-label={t("title")} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium">{t("title")}</h3>
        <SegmentPill segment={client.segment} />
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tiles.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted/60 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
