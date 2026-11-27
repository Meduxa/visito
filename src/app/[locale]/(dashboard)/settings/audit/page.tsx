import { ArrowLeft, ScrollText } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { fullDate, fullDateTime } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

// The owner's audit log (SPEC 4.14): who did what and when. RLS: owner only.
const PAGE = 50;
const GROUPS = {
  all: null,
  team: ["invitation.", "membership.", "staff.", "tenant.", "auth.", "time_off.", "payroll."],
  clients: ["client.", "clients.", "consent.", "dental_notes."],
  bookings: ["booking.", "bookings."],
  settings: ["settings.", "service.", "services.", "location.", "billing.", "review.", "report."],
  platform: ["platform."],
} as const;
type Group = keyof typeof GROUPS;

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/audit">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auditLog" });
  return { title: t("title") };
}

export default async function AuditPage({ params, searchParams }: PageProps<"/[locale]/settings/audit">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || tenant.role !== "owner") redirect(`/${locale}/dashboard`);
  const sp = await searchParams;
  const group: Group = String(sp.group) in GROUPS ? (String(sp.group) as Group) : "all";
  const page = Math.max(0, Number(sp.page) || 0);
  const t = await getTranslations();
  const db = await createClient();

  let q = db
    .from("audit_log")
    .select("id, at, actor_id, action, entity, meta", { count: "exact" })
    .eq("tenant_id", tenant.tenantId)
    .order("at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  const prefixes = GROUPS[group];
  if (prefixes) q = q.or(prefixes.map((p) => `action.like.${p}%`).join(","));
  const { data: found, count } = await q;
  // a "role change" that changed nothing is noise (test plan #61)
  const rows = (found ?? []).filter((r) => {
    if (r.action !== "membership.updated") return true;
    const m = (r.meta ?? {}) as Record<string, unknown>;
    return m.from_role !== m.to_role || m.from_status !== m.to_status;
  });
  const metaOf = (meta: unknown) =>
    meta && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : {};

  const ids = (key: string) =>
    rows.map((r) => metaOf(r.meta)[key]).filter((x): x is string => typeof x === "string");
  const actorIds = [
    ...new Set([...rows.map((r) => r.actor_id).filter((x): x is string => !!x), ...ids("user_id")]),
  ];
  const staffIds = [...new Set(ids("staff_id"))];
  const { data: staffRows } = staffIds.length
    ? await db.from("staff").select("id, display_name").eq("tenant_id", tenant.tenantId).in("id", staffIds)
    : { data: [] as { id: string; display_name: string }[] };
  const staffName = new Map((staffRows ?? []).map((s) => [s.id, s.display_name]));
  const { data: people } = actorIds.length
    ? await db.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const label = (action: string) => {
    const key = `auditLog.actions.${action.replace(/\./g, "_")}`;
    return t.has(key) ? t(key as "auditLog.title") : action;
  };
  // Details in plain words: names instead of IDs, money and dates formatted,
  // internal fields left out (test plan #61).
  const tx = t as unknown as ((k: string, v?: Record<string, string>) => string) & {
    has: (k: string) => boolean;
  };
  const word = (key: string, fallback: string) => (tx.has(key) ? tx(key) : fallback);
  const when = (v: string) => (v.length > 10 ? fullDateTime(t, v) : fullDate(t, v));
  const MONEY: Record<string, string> = {
    amount_minor: "amount",
    salary_minor: "salary",
    paid: "paid",
    total: "total",
  };
  const DATES: Record<string, string> = {
    starts_at: "starts",
    ends_at: "ends",
    until: "until",
    due: "due",
    paid_on: "paidOn",
    from: "from",
    to: "to",
  };
  const PLAIN = [
    "email",
    "count",
    "rows",
    "imported",
    "inserted",
    "skipped",
    "hours",
    "segments",
    "note",
    "month",
  ];
  const detail = (action: string, meta: unknown) => {
    const m = metaOf(meta);
    const out: string[] = [];
    const add = (labelKey: string, value: string) => out.push(`${tx(`auditLog.meta.${labelKey}`)}: ${value}`);
    if (typeof m.staff_id === "string" && staffName.has(m.staff_id)) out.push(staffName.get(m.staff_id)!);
    if (typeof m.user_id === "string" && nameOf.has(m.user_id)) out.push(nameOf.get(m.user_id)!);
    if (typeof m.how === "string") out.push(word(`auditLog.how.${m.how}`, m.how));
    if (typeof m.kind === "string" && action.startsWith("payroll."))
      out.push(word(`payroll.${m.kind}`, m.kind));
    if (typeof m.role === "string") add("role", word(`roles.${m.role}`, m.role));
    if (m.from_role !== m.to_role && typeof m.from_role === "string" && typeof m.to_role === "string")
      add("role", `${word(`roles.${m.from_role}`, m.from_role)} → ${word(`roles.${m.to_role}`, m.to_role)}`);
    if (m.from_status !== m.to_status && typeof m.to_status === "string")
      out.push(word(`auditLog.memberStatus.${m.to_status}`, m.to_status));
    if (typeof m.status === "string" && action === "review.moderated")
      out.push(word(`auditLog.reviewStatus.${m.status}`, m.status));
    for (const [k, label] of Object.entries(MONEY))
      if (typeof m[k] === "number") add(label, formatMoney(m[k] as number));
    if (typeof m.pct === "number") add("pct", `${m.pct}%`);
    if (typeof m.method === "string") add("method", word(`payroll.methods.${m.method}`, m.method));
    for (const [k, label] of Object.entries(DATES))
      if (typeof m[k] === "string" && /^d{4}-d{2}-d{2}/.test(m[k] as string))
        add(label, when(m[k] as string));
    for (const k of PLAIN)
      if ((typeof m[k] === "string" && m[k]) || typeof m[k] === "number") add(k, String(m[k]));
    return out.join(" · ").slice(0, 200);
  };

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/settings/business">
          <ArrowLeft aria-hidden />
          {t("nav.settings")}
        </Link>
      </Button>
      <PageHeader title={t("auditLog.title")} description={t("auditLog.subtitle")} />
      <nav
        aria-label={t("auditLog.title")}
        className="flex flex-wrap gap-1 self-start rounded-lg bg-muted p-1"
      >
        {(Object.keys(GROUPS) as Group[]).map((g) => (
          <Link
            key={g}
            href={g === "all" ? "/settings/audit" : `/settings/audit?group=${g}`}
            aria-current={g === group ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center rounded-md px-3 text-sm",
              g === group ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`auditLog.groups.${g}`)}
          </Link>
        ))}
      </nav>
      {!rows.length ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={<ScrollText />} title={t("auditLog.empty")} />
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-medium">{label(r.action)}</span>
                <span className="text-muted-foreground">
                  {r.actor_id ? (nameOf.get(r.actor_id) ?? t("auditLog.visito")) : t("auditLog.system")}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{fullDateTime(t, r.at)}</span>
              </div>
              {detail(r.action, r.meta) && (
                <p className="text-xs break-words text-muted-foreground">{detail(r.action, r.meta)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {(count ?? 0) > (page + 1) * PAGE && (
        <Button variant="outline" asChild className="h-11 self-start md:h-9">
          <Link href={`/settings/audit?${group !== "all" ? `group=${group}&` : ""}page=${page + 1}`}>
            {t("auditLog.older")}
          </Link>
        </Button>
      )}
    </div>
  );
}
