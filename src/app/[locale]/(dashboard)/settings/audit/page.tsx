import { ArrowLeft, ScrollText } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { fullDateTime } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

// The owner's audit log (SPEC 4.14): who did what and when. RLS: owner only.
const PAGE = 50;
const GROUPS = {
  all: null,
  team: ["invitation.", "membership.", "staff.", "tenant."],
  clients: ["client.", "clients.", "consent.", "dental_notes."],
  bookings: ["booking.", "bookings."],
  settings: ["settings.", "service.", "services."],
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
  const { data: rows, count } = await q;

  const actorIds = [...new Set((rows ?? []).map((r) => r.actor_id).filter((x): x is string => !!x))];
  const { data: people } = actorIds.length
    ? await db.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const nameOf = new Map((people ?? []).map((p) => [p.id, p.full_name]));
  const label = (action: string) => {
    const key = `auditLog.actions.${action.replace(/\./g, "_")}`;
    return t.has(key) ? t(key as "auditLog.title") : action;
  };
  const detail = (meta: unknown) => {
    const m = meta && typeof meta === "object" ? Object.entries(meta as Record<string, unknown>) : [];
    return m
      .filter(([, v]) => v !== null && typeof v !== "object")
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ")
      .slice(0, 160);
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
      {!rows?.length ? (
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
              {detail(r.meta) && (
                <p className="text-xs break-words text-muted-foreground">{detail(r.meta)}</p>
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
