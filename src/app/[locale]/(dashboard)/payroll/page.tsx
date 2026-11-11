import { formatInTimeZone } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Download, HandCoins, Settings2, Wallet, WalletCards } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { shiftMonth } from "@/features/payroll/compute";
import { PayrollHidden, PayrollLocked } from "@/features/payroll/components/payroll-locked";
import { PayrollView } from "@/features/payroll/components/payroll-view";
import { isMonth, loadPayroll, payrollAccess, plansWithPayroll } from "@/features/payroll/payroll";
import { Link } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant, isReadOnly } from "@/lib/tenant";
import { DEFAULT_TZ } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/payroll">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "payroll" });
  return { title: t("title") };
}

export default async function PayrollPage({ params, searchParams }: PageProps<"/[locale]/payroll">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  const db = await createClient();
  const access = await payrollAccess(db, tenant);
  if (access === "hidden") return <PayrollHidden />;
  if (access === "locked") return <PayrollLocked plans={await plansWithPayroll(db)} />;

  const t = await getTranslations();
  const { data: tz } = await db.from("tenants").select("timezone").eq("id", tenant.tenantId).single();
  const today = formatInTimeZone(new Date(), tz?.timezone ?? DEFAULT_TZ, "yyyy-MM-dd");
  const sp = await searchParams;
  const month = isMonth(sp.month) ? sp.month : today.slice(0, 7);
  const payroll = await loadPayroll(db, tenant.tenantId, month, locale);
  const m = Number(month.slice(5));
  const title = t("dates.monthYear", {
    month: t(`dates.monthTitle.${m}` as "dates.monthTitle.1"),
    year: month.slice(0, 4),
  });
  const nav = (by: number) => `/payroll?month=${shiftMonth(month, by)}`;

  return (
    <div className="flex max-w-5xl flex-col gap-5">
      <PageHeader
        title={t("payroll.title")}
        description={t("payroll.subtitle")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="h-11 md:h-9">
              <Link href="/payroll/settings">
                <Settings2 aria-hidden />
                {t("payroll.settingsLink")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 md:h-9">
              <a href={`/api/export/payroll?month=${month}&locale=${locale}`} download>
                <Download aria-hidden />
                {t("reports.excel")}
              </a>
            </Button>
          </div>
        }
      />

      <nav aria-label={t("payroll.month")} className="flex items-center gap-2">
        <Button asChild variant="outline" size="icon" className="size-11 md:size-9">
          <Link href={nav(-1)} aria-label={t("payroll.prevMonth")}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <h2 className="min-w-40 text-center text-base font-semibold" aria-live="polite">
          {title}
        </h2>
        <Button asChild variant="outline" size="icon" className="size-11 md:size-9">
          <Link href={nav(1)} aria-label={t("payroll.nextMonth")}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
        {month !== today.slice(0, 7) && (
          <Button asChild variant="ghost" className="h-11 md:h-9">
            <Link href="/payroll">{t("payroll.thisMonth")}</Link>
          </Button>
        )}
      </nav>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={<Wallet />}
          label={t("payroll.toPay")}
          value={formatMoney(payroll.totals.totalMinor)}
        />
        <StatCard
          icon={<HandCoins />}
          tone="info"
          label={t("payroll.paid")}
          value={formatMoney(payroll.totals.paidMinor)}
        />
        <StatCard
          icon={<WalletCards />}
          tone={payroll.totals.balanceMinor > 0 ? "warning" : "brand"}
          label={t("payroll.owed")}
          value={formatMoney(payroll.totals.balanceMinor)}
        />
      </div>

      <PayrollView month={month} today={today} rows={payroll.staff} readOnly={isReadOnly(tenant)} />
    </div>
  );
}
