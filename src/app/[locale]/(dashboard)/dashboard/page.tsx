import {
  Banknote,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Gauge,
  Gift,
  Link2,
  MessageSquare,
  Scissors,
  TriangleAlert,
  UserPlus,
  UserX,
  UsersRound,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboard } from "@/features/reports/dashboard";
import { Link } from "@/i18n/navigation";
import { requireUser } from "@/lib/auth";
import { fullDate } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";

// where each first step is done
const checklist = [
  { key: "services", icon: Scissors, href: "/services" },
  { key: "staff", icon: UsersRound, href: "/staff" },
  { key: "hours", icon: CalendarClock, href: "/staff" },
  { key: "link", icon: Link2, href: "/settings/booking" },
  { key: "sms", icon: MessageSquare, href: "/settings/sms" },
] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/dashboard">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" });
  return { title: t("dashboard") };
}

export default async function DashboardPage({ params }: PageProps<"/[locale]/dashboard">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [user, tenant] = await Promise.all([requireUser(locale), getActiveTenant()]);
  const t = await getTranslations();
  const firstName = user.fullName.split(" ")[0];
  const manager = !!tenant && canManage(tenant.role);

  return (
    <>
      <PageHeader
        title={firstName ? t("dashboard.welcome", { name: firstName }) : t("dashboard.welcomeNoName")}
        description={t("dashboard.subtitle", { business: tenant?.name ?? "" })}
        actions={
          manager ? (
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href="/reports">{t("dashboard.reports")}</Link>
            </Button>
          ) : (
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href="/my-day">{t("nav.myDay")}</Link>
            </Button>
          )
        }
      />

      {manager && tenant && (
        <Suspense fallback={<NumbersLoading />}>
          <Numbers tenantId={tenant.tenantId} role={tenant.role} locale={locale} />
        </Suspense>
      )}
    </>
  );
}

function NumbersLoading() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

// The numbers take a month report to compute; streamed so the page itself shows at once.
async function Numbers({ tenantId, role, locale }: { tenantId: string; role: string; locale: string }) {
  const t = await getTranslations();
  const d = await getDashboard(await createClient(), tenantId, role, locale);
  return (
    <>
      <div className="flex flex-col gap-6">
        {d.sms.low && (
          <Link
            href="/settings/sms"
            role="alert"
            className="flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm text-warning-ink hover:underline"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            {d.sms.balance <= 0 ? t("smsSettings.empty") : t("smsSettings.low", { count: d.sms.balance })}
          </Link>
        )}
        <section aria-labelledby="dash-today" className="flex flex-col gap-3">
          <h2 id="dash-today" className="text-sm font-medium text-muted-foreground">
            {t("dashboard.today")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={<CalendarCheck />}
              label={t("dashboard.stats.bookings")}
              value={d.todayBookings}
              href="/calendar"
            />
            {d.money && (
              <StatCard
                icon={<Banknote />}
                label={t("dashboard.stats.received")}
                value={formatMoney(d.todayReceivedMinor)}
                href="/cash"
              />
            )}
            <StatCard
              icon={<MessageSquare />}
              label={t("dashboard.stats.sms")}
              value={d.sms.balance}
              tone={d.sms.low ? "warning" : "brand"}
              href="/settings/sms"
            />
          </div>
        </section>

        <section aria-labelledby="dash-month" className="flex flex-col gap-3">
          <h2 id="dash-month" className="text-sm font-medium text-muted-foreground">
            {t("dashboard.thisMonth")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {d.money && (
              <StatCard
                icon={<Banknote />}
                label={t("dashboard.stats.revenue")}
                value={formatMoney(d.month.receivedMinor)}
                href="/reports"
              />
            )}
            <StatCard
              icon={<Gauge />}
              label={t("dashboard.stats.occupancy")}
              value={d.month.occupancyPct === null ? "—" : `${d.month.occupancyPct}%`}
              hint={t("dashboard.stats.occupancyHint")}
              href="/reports"
            />
            <StatCard
              icon={<UserPlus />}
              label={t("dashboard.stats.newClients")}
              value={d.month.newClients}
              href="/reports"
            />
            <StatCard
              icon={<UserX />}
              label={t("dashboard.stats.noShows")}
              value={d.month.noShows}
              tone={d.month.noShows > 0 ? "danger" : "brand"}
              href="/reports"
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="size-4" aria-hidden />
                {t("dashboard.birthdays")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {d.birthdays.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.noBirthdays")}</p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {d.birthdays.map((b) => (
                    <li key={b.id} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                      <span className="font-medium">{b.name}</span>
                      <span className="text-muted-foreground">
                        {b.date === d.today
                          ? t("dashboard.todayWord")
                          : fullDate(t, b.date).replace(/\s\d{4}$/, "")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {Object.values(d.checklist).some((done) => !done) && (
            <Card>
              <CardHeader>
                <CardTitle>{t("dashboard.checklistTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col divide-y">
                  {checklist.map(({ key, icon: Icon, href }) => {
                    const done = d.checklist[key];
                    return (
                      <li key={key}>
                        <Link
                          href={href}
                          className="-mx-2 flex min-h-12 items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                        >
                          {done ? (
                            <CheckCircle2
                              className="size-5 shrink-0 text-success"
                              aria-label={t("dashboard.done")}
                            />
                          ) : (
                            <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                          )}
                          <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                          <span
                            className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : ""}`}
                          >
                            {t(`dashboard.checklist.${key}`)}
                          </span>
                          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
