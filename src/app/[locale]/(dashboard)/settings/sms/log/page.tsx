import { ArrowLeft, MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill, type PillTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { getSmsLog, LOG_PAGE, LOG_STATUSES, type LogStatus } from "@/features/sms/queries";
import { Link } from "@/i18n/navigation";
import { fullDateTime } from "@/lib/date-format";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { cn } from "@/lib/utils";

const TONE: Record<string, PillTone> = {
  queued: "warning",
  sending: "warning",
  sent: "info",
  delivered: "success",
  failed: "danger",
  skipped: "neutral",
};

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/sms/log">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "smsLog" });
  return { title: t("title") };
}

export default async function SmsLogPage({ params, searchParams }: PageProps<"/[locale]/settings/sms/log">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  const sp = await searchParams;
  const status = (LOG_STATUSES as readonly string[]).includes(String(sp.status))
    ? (sp.status as LogStatus)
    : "all";
  const page = Math.max(0, Number(sp.page) || 0);
  const t = await getTranslations();
  const { rows, total } = await getSmsLog(tenant.tenantId, status, page);

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/settings/sms">
          <ArrowLeft aria-hidden />
          {t("smsLog.back")}
        </Link>
      </Button>
      <PageHeader title={t("smsLog.title")} />
      <nav aria-label={t("smsLog.title")} className="flex flex-wrap gap-1 self-start rounded-lg bg-muted p-1">
        {LOG_STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "all" ? "/settings/sms/log" : `/settings/sms/log?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center rounded-md px-3 text-sm",
              s === status ? "bg-card font-medium shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`smsLog.filters.${s}`)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState icon={<MessageSquare />} title={t("smsLog.empty")} />
        </div>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {rows.map((m) => (
            <li key={m.id} className="flex flex-col gap-1 px-4 py-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-medium">{m.client ?? m.to}</span>
                {m.client && <span className="text-muted-foreground tabular-nums">{m.to}</span>}
                <span className="text-muted-foreground">{t(`smsLog.types.${m.type as "reminder"}`)}</span>
                <span className="ml-auto text-xs text-muted-foreground">{fullDateTime(t, m.at)}</span>
              </div>
              <p className="text-sm break-words text-muted-foreground">{m.body}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <StatusPill tone={TONE[m.status]} dot>
                  {t(`smsLog.status.${m.status as "sent"}`)}
                </StatusPill>
                <span className="text-muted-foreground">{t("smsLog.parts", { count: m.segments })}</span>
                {m.error && (
                  <span className="text-destructive">
                    {/* "undelivered:UNDELIV" = our reason + the SMS company's own code */}
                    {(() => {
                      const [code, detail] = m.error.split(":");
                      const label = t.has(`smsLog.errors.${code}`)
                        ? t(`smsLog.errors.${code as "no_credits"}`)
                        : code;
                      return detail ? `${label} (${detail})` : label;
                    })()}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {total > (page + 1) * LOG_PAGE && (
        <Button variant="outline" asChild className="h-11 self-start md:h-9">
          <Link href={`/settings/sms/log?${status !== "all" ? `status=${status}&` : ""}page=${page + 1}`}>
            {t("smsLog.more")}
          </Link>
        </Button>
      )}
    </div>
  );
}
