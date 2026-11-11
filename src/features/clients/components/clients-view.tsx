"use client";

import { CalendarPlus, Download, FileSpreadsheet, Plus, Search, TriangleAlert, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { DetailPanel } from "@/components/detail-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import type { ClientRow } from "../queries";
import { clientSorts, PAGE_SIZE, segments, type ClientListParams, type Segment } from "../schema";
import { ClientVisits } from "@/features/booking/components/client-visits";
import { DentalNotes } from "@/features/booking/components/dental-notes";
import { BulkSmsDialog, ClientSmsDialog } from "@/features/sms/components/sms-dialogs";
import { ClientForm } from "./client-form";
import { ClientRights, ConsentHistory, MergeClient } from "./client-extras";
import { ClientStats, SegmentPill, useVisitDate } from "./client-stats";
import { ColumnsMenu, QuickNote } from "./list-tools";
import type { ClientField, CustomValues, SegmentRules } from "../fields";

const fullName = (c: ClientRow) => [c.firstName, c.lastName].filter(Boolean).join(" ");
const ALL = "_all";

// Table columns from 1280 px wide (with the menu beside it, narrower screens overlap); below that, cards.
// Which columns: chosen in the "Columns" menu (decision 026); the name is always first.
const WIDTH: Record<string, string> = {
  phone: "9.5rem",
  group: "6.5rem",
  lastVisit: "7.5rem",
  nextVisit: "7.5rem",
  visits: "4rem",
  spent: "6rem",
  average: "6rem",
};
const RIGHT = ["visits", "spent", "average"];
const OWN_FIELD = "minmax(7rem,10rem)";
const gridStyle = (columns: string[]) =>
  ({
    "--cols": ["minmax(11rem,1fr)", ...columns.map((c) => WIDTH[c] ?? OWN_FIELD)].join(" "),
  }) as CSSProperties;
// With many columns the table scrolls sideways instead of squeezing the name:
// its narrowest width = name + every column + the gaps (1rem), padding and the note button.
const tableStyle = (columns: string[], note: boolean) =>
  ({
    "--minw": `${11 + columns.reduce((a, c) => a + 1 + parseFloat(WIDTH[c] ?? "7"), 0) + 2 + (note ? 2.5 : 0)}rem`,
  }) as CSSProperties;

export function ClientsView({
  clients,
  total,
  segmentCounts,
  view,
  tags,
  staff,
  canManage,
  canSeeMoney,
  isOwner,
  isDental,
  timeZone,
  fields,
  columns,
  rules,
}: {
  clients: ClientRow[];
  total: number;
  segmentCounts: Record<Segment, number>;
  view: ClientListParams;
  tags: string[];
  staff: { id: string; name: string }[];
  canManage: boolean;
  canSeeMoney: boolean;
  isOwner: boolean;
  isDental: boolean;
  timeZone: string;
  fields: ClientField[];
  /** the desktop table's columns, already limited to what this person may see */
  columns: string[];
  rules: SegmentRules;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const visitDate = useVisitDate(timeZone);
  const [query, setQuery] = useState(view.q);
  const [openId, setOpenId] = useState<string | "new" | null>(null);
  // "clear filters" empties the search box itself: the typing delay must not re-apply the old filters
  const cleared = useRef(false);

  // The list's view lives in the address: a link or reload opens the same view.
  const go = (patch: Partial<Record<keyof ClientListParams, string | undefined>>) => {
    const next: Record<string, string | undefined> = {
      q: view.q || undefined,
      segment: view.segment,
      tag: view.tag,
      upcoming: view.upcoming,
      birthday: view.birthday,
      noshow: view.noshow,
      sort: view.sort === "added" ? undefined : view.sort,
      ...patch,
    };
    if (!("page" in patch)) delete next.page; // a new filter starts on page 1
    const qs = new URLSearchParams(Object.entries(next).filter((e): e is [string, string] => !!e[1]));
    router.replace(qs.size ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // Search runs on the server (large client lists), debounced while typing.
  useEffect(() => {
    if (query === view.q) return;
    if (cleared.current) {
      cleared.current = false;
      return;
    }
    const id = setTimeout(() => go({ q: query || undefined }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` is rebuilt every render from `view`
  }, [query, view.q]);

  const open = openId && openId !== "new" ? (clients.find((c) => c.id === openId) ?? null) : null;
  const pages = Math.ceil(total / PAGE_SIZE);
  const title = t(isDental ? "clients.titleDental" : "clients.title");
  const anyFilter = !!(view.q || view.segment || view.tag || view.upcoming || view.birthday || view.noshow);
  const allCount = Object.values(segmentCounts).reduce((a, n) => a + n, 0);
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const colLabel = (c: string) =>
    c.startsWith("f:")
      ? (fieldById.get(c.slice(2))?.label ?? "")
      : t(`clients.col${c[0].toUpperCase()}${c.slice(1)}` as "clients.colPhone");
  const ownValue = (custom: CustomValues, id: string) => {
    const v = custom[id];
    if (v === undefined) return "—";
    if (typeof v === "boolean") return v ? t("clients.ownFields.yes") : t("clients.ownFields.no");
    if (fieldById.get(id)?.kind === "date" && typeof v === "string") return v.split("-").reverse().join(".");
    return String(v);
  };
  const cell = (c: ClientRow, col: string) => {
    switch (col) {
      case "phone":
        return (
          <span className="text-sm text-muted-foreground tabular-nums">{c.phone ?? c.email ?? "—"}</span>
        );
      case "group":
        return <SegmentPill segment={c.segment} />;
      case "lastVisit":
        return <span className="text-sm">{visitDate(c.lastVisitAt)}</span>;
      case "nextVisit":
        return <span className="text-sm">{visitDate(c.nextVisitAt)}</span>;
      case "visits":
        return <span className="text-sm tabular-nums">{c.visits}</span>;
      case "spent":
        return <span className="text-sm tabular-nums">{formatMoney(c.spentMinor ?? 0)}</span>;
      case "average":
        return (
          <span className="text-sm text-muted-foreground tabular-nums">
            {c.averageMinor === null ? "—" : formatMoney(c.averageMinor)}
          </span>
        );
      default:
        return <span className="truncate text-sm">{ownValue(c.custom, col.slice(2))}</span>;
    }
  };
  // the Excel download: exactly this view (search, group, filters, sorting), all pages
  const exportHref = () => {
    const qs = new URLSearchParams(
      Object.entries({
        q: view.q || undefined,
        segment: view.segment,
        tag: view.tag,
        upcoming: view.upcoming,
        birthday: view.birthday,
        noshow: view.noshow,
        sort: view.sort === "added" ? undefined : view.sort,
        locale,
      }).filter((e): e is [string, string] => !!e[1]),
    );
    return `/api/export/clients?${qs}`;
  };

  const toggle = (key: "upcoming" | "birthday" | "noshow") => (
    <Button
      key={key}
      variant="outline"
      size="sm"
      aria-pressed={!!view[key]}
      onClick={() => go({ [key]: view[key] ? undefined : "1" })}
      className={cn(
        "h-11 shrink-0 rounded-full md:h-8",
        view[key] && "border-primary bg-accent text-accent-foreground",
      )}
    >
      {t(`clients.filters.${key}`)}
    </Button>
  );

  return (
    <>
      <PageHeader
        title={title}
        description={t("clients.subtitle")}
        actions={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <BulkSmsDialog tags={tags} />
              {total > 0 && (
                <Button variant="outline" className="h-11 md:h-9" asChild>
                  <a href={exportHref()} download>
                    <Download aria-hidden />
                    {t("clients.exportList")}
                  </a>
                </Button>
              )}
              <Button variant="outline" className="h-11 md:h-9" asChild>
                <Link href="/clients/import">
                  <FileSpreadsheet aria-hidden />
                  {t("clients.import")}
                </Link>
              </Button>
              <Button className="h-11 md:h-9" onClick={() => setOpenId("new")}>
                <Plus aria-hidden />
                {t("clients.new")}
              </Button>
            </div>
          )
        }
      />

      {total === 0 && !anyFilter ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={<Users />}
            title={t("clients.emptyTitle")}
            description={t("clients.emptyBody")}
            action={
              canManage && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button className="h-11 md:h-9" onClick={() => setOpenId("new")}>
                    {t("clients.new")}
                  </Button>
                  <Button variant="outline" className="h-11 md:h-9" asChild>
                    <Link href="/clients/import">{t("clients.import")}</Link>
                  </Button>
                </div>
              )
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* automatic groups */}
          <nav
            aria-label={t("clients.segments.label")}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {[undefined, ...segments].map((s) => {
              const on = view.segment === s;
              const n = s ? segmentCounts[s] : allCount;
              return (
                <button
                  key={s ?? ALL}
                  type="button"
                  aria-current={on ? "true" : undefined}
                  // a chosen group beyond the edge of a phone screen scrolls into view
                  ref={
                    on && s ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined
                  }
                  onClick={() => go({ segment: s })}
                  className={cn(
                    "flex h-11 shrink-0 items-center gap-2 rounded-full border bg-card px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:h-9",
                    on && "border-primary bg-accent text-accent-foreground hover:bg-accent",
                  )}
                >
                  {s ? t(`clients.segments.${s}`) : t("clients.segments.all")}
                  <span className="text-xs text-muted-foreground tabular-nums">{n}</span>
                </button>
              );
            })}
          </nav>
          <p className="-mt-2 hidden text-xs text-muted-foreground sm:block">
            {t("clients.segments.hint", {
              regularMax: rules.vipVisits - 1,
              vip: rules.vipVisits,
              atRisk: rules.atRiskDays,
              lost: rules.lostDays,
            })}
          </p>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                type="search"
                aria-label={t("common.search")}
                placeholder={t("clients.searchPlaceholder")}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-11 bg-card pl-9 md:h-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              {tags.length > 0 && (
                <Select value={view.tag ?? ALL} onValueChange={(v) => go({ tag: v === ALL ? undefined : v })}>
                  <SelectTrigger
                    aria-label={t("clients.filters.tag")}
                    className="h-11 w-full bg-card sm:w-40 md:h-9"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("clients.filters.tagAll")}</SelectItem>
                    {tags.map((tag) => (
                      <SelectItem key={tag} value={tag}>
                        {tag}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={view.sort} onValueChange={(v) => go({ sort: v === "added" ? undefined : v })}>
                <SelectTrigger
                  aria-label={t("clients.sort.label")}
                  className={cn("h-11 w-full bg-card sm:w-48 md:h-9", tags.length === 0 && "col-span-2")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {clientSorts
                    .filter((s) => s !== "spent" || canSeeMoney)
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        {t(`clients.sort.${s}`)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="-mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 sm:flex-wrap">
              {(["upcoming", "birthday", "noshow"] as const).map(toggle)}
            </div>
            <span className="text-sm text-muted-foreground sm:ml-auto" aria-live="polite">
              {t("clients.total", { count: total })}
            </span>
            <ColumnsMenu shown={columns} fields={fields} canSeeMoney={canSeeMoney} />
          </div>

          {clients.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              {t("clients.noMatch")}
              {anyFilter && (
                <Button
                  variant="outline"
                  className="h-11 md:h-9"
                  onClick={() => {
                    cleared.current = query !== ""; // only when the box changes (the delay runs then)
                    setQuery("");
                    router.replace(pathname, { scroll: false });
                  }}
                >
                  {t("clients.filters.clear")}
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card xl:overflow-x-auto">
              <div style={tableStyle(columns, canManage)} className="xl:min-w-(--minw)">
                <div className="hidden items-center border-b bg-muted/50 pr-1 xl:flex">
                  <div
                    style={gridStyle(columns)}
                    className="grid flex-1 grid-cols-(--cols) gap-4 px-4 py-2.5 text-xs font-medium text-muted-foreground"
                  >
                    <span>{t("clients.colName")}</span>
                    {columns.map((col) => (
                      <span key={col} className={cn("truncate", RIGHT.includes(col) && "text-right")}>
                        {colLabel(col)}
                      </span>
                    ))}
                  </div>
                  {canManage && <span className="w-9 shrink-0" aria-hidden />}
                </div>
                <ul className="divide-y">
                  {clients.map((c) => (
                    <li key={c.id} className="flex items-stretch pr-1 hover:bg-muted/50">
                      <button
                        type="button"
                        onClick={() => setOpenId(c.id)}
                        style={gridStyle(columns)}
                        className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset xl:grid-cols-(--cols)"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="flex items-center gap-1.5 text-sm font-medium break-words">
                            {fullName(c)}
                            {c.importantNote && (
                              <TriangleAlert
                                className="size-3.5 shrink-0 text-warning"
                                aria-label={t("clients.fields.importantNote")}
                              />
                            )}
                          </span>
                          {(c.tags.length > 0 || c.consentSms || c.consentEmail || c.blockedOnline) && (
                            <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                              {c.tags.length > 0 && <span>{c.tags.join(" · ")}</span>}
                              {c.consentSms && <StatusPill tone="success">{t("clients.sms")}</StatusPill>}
                              {c.consentEmail && <StatusPill tone="success">{t("clients.email")}</StatusPill>}
                              {c.blockedOnline && (
                                <StatusPill tone="danger">{t("clients.blocked")}</StatusPill>
                              )}
                            </span>
                          )}
                        </span>
                        {/* phone: contact top right, then the group and "last … · next … · N visits" */}
                        <span className="text-right text-sm text-muted-foreground tabular-nums xl:hidden">
                          {c.phone ?? c.email ?? "—"}
                        </span>
                        <span className="xl:hidden">
                          <SegmentPill segment={c.segment} />
                        </span>
                        <span className="col-span-2 text-xs text-muted-foreground xl:hidden">
                          {t("clients.mobileLine", {
                            last: visitDate(c.lastVisitAt),
                            next: visitDate(c.nextVisitAt),
                            visits: c.visits,
                          })}
                        </span>
                        {/* desktop: the chosen columns */}
                        {columns.map((col) => (
                          <span
                            key={col}
                            className={cn("hidden min-w-0 xl:flex", RIGHT.includes(col) && "justify-end")}
                          >
                            {cell(c, col)}
                          </span>
                        ))}
                      </button>
                      {canManage && <QuickNote clientId={c.id} name={fullName(c)} note={c.notes} />}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {pages > 1 && (
            <nav className="flex items-center justify-between gap-2" aria-label="pagination">
              <Button
                variant="outline"
                className="h-11 md:h-9"
                disabled={view.page === 0}
                onClick={() => go({ page: String(view.page - 1) })}
              >
                {t("clients.prev")}
              </Button>
              <span className="text-sm text-muted-foreground tabular-nums">
                {view.page + 1} / {pages}
              </span>
              <Button
                variant="outline"
                className="h-11 md:h-9"
                disabled={view.page + 1 >= pages}
                onClick={() => go({ page: String(view.page + 1) })}
              >
                {t("clients.next")}
              </Button>
            </nav>
          )}
        </div>
      )}

      <DetailPanel
        open={openId !== null}
        onOpenChange={(o) => !o && setOpenId(null)}
        title={open ? fullName(open) : t("clients.new")}
      >
        {openId !== null && (
          <div className="flex flex-col gap-8">
            {open && <ClientStats client={open} canSeeMoney={canSeeMoney} timeZone={timeZone} />}
            {open && (
              <Button className="h-11 self-start md:h-9" asChild>
                <Link href={`/calendar?for=${open.id}`}>
                  <CalendarPlus aria-hidden />
                  {t("clients.newBooking")}
                </Link>
              </Button>
            )}
            <ClientForm
              key={openId}
              client={open}
              staff={staff}
              fields={fields}
              readOnly={!canManage}
              onSaved={(id) => {
                setOpenId(id);
                router.refresh();
              }}
            />
            {open && <ClientVisits clientId={open.id} />}
            {open && isDental && <DentalNotes clientId={open.id} bookingId={null} timeZone={timeZone} />}
            {open && canManage && (
              <>
                <ClientSmsDialog clientId={open.id} phone={open.phone} />
                <ConsentHistory
                  key={`h-${open.id}-${open.consentSms}-${open.consentEmail}`}
                  clientId={open.id}
                />
                <MergeClient clientId={open.id} name={fullName(open)} onMerged={() => router.refresh()} />
                <ClientRights
                  clientId={open.id}
                  name={fullName(open)}
                  isOwner={isOwner}
                  onAnonymized={() => {
                    setOpenId(null);
                    router.refresh();
                  }}
                />
              </>
            )}
          </div>
        )}
      </DetailPanel>
    </>
  );
}
