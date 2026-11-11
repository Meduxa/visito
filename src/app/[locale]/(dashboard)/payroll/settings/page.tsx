import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { PaySettingsView } from "@/features/payroll/components/pay-settings-view";
import { PayrollHidden, PayrollLocked } from "@/features/payroll/components/payroll-locked";
import { loadPaySettings, payrollAccess, plansWithPayroll } from "@/features/payroll/payroll";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant, isReadOnly } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/payroll/settings">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "payroll" });
  return { title: t("settingsTitle") };
}

export default async function PaySettingsPage({ params }: PageProps<"/[locale]/payroll/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  const db = await createClient();
  const access = await payrollAccess(db, tenant);
  if (access === "hidden") return <PayrollHidden />;
  if (access === "locked") return <PayrollLocked plans={await plansWithPayroll(db)} />;
  const t = await getTranslations("payroll");
  const data = await loadPaySettings(db, tenant.tenantId, locale);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/payroll">
          <ArrowLeft aria-hidden />
          {t("title")}
        </Link>
      </Button>
      <PageHeader title={t("settingsTitle")} description={t("settingsSubtitle")} />
      <PaySettingsView data={data} readOnly={isReadOnly(tenant)} />
    </div>
  );
}
