import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SmsSettingsView } from "@/features/sms/components/sms-settings-view";
import { getSmsOverview } from "@/features/sms/queries";
import { renderSms, TEMPLATE_TYPES, type TemplateType } from "@/features/sms/render";
import { PLATFORM_TEXT_TYPES, smsText, type PlatformTextType } from "@/features/sms/texts";
import { shortDate } from "@/lib/date-format";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/sms">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "smsSettings" });
  return { title: t("title") };
}

export default async function SmsSettingsPage({ params }: PageProps<"/[locale]/settings/sms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) redirect(`/${locale}/dashboard`);
  const t = await getTranslations("smsSettings");

  // the default texts in every language, for the editor's "back to default"
  const defaults = Object.fromEntries(
    await Promise.all(
      (["ka", "en", "ru"] as const).map(async (l) => {
        const d = await getTranslations({ locale: l, namespace: "smsTemplates" });
        return [l, Object.fromEntries(TEMPLATE_TYPES.map((type) => [type, d.raw(type) as string]))];
      }),
    ),
  ) as Record<"ka" | "en" | "ru", Record<TemplateType, string>>;

  // the texts the clients get now, filled with an example (decision 033)
  const overview = await getSmsOverview(tenant.tenantId);
  const tAll = await getTranslations({ locale: overview.locale });
  const sample = {
    client_name: tAll("smsSettings.sample.client_name"),
    business_name: tenant.name,
    service: tAll("smsSettings.sample.service"),
    staff: tAll("smsSettings.sample.staff"),
    date: shortDate(tAll, "2026-11-09"),
    time: "12:15",
    address: tAll("smsSettings.sample.address"),
    phone: tAll("smsSettings.sample.phone"),
    manage_link: "https://visito.ge/r/Xk3pQ9vRm2LbT7wZ4nYc8dHf6gJs1aEq", // as long as a real link
  };
  const previews = Object.fromEntries(
    await Promise.all(
      PLATFORM_TEXT_TYPES.map(async (type) => [
        type,
        renderSms(await smsText(tenant.tenantId, type, overview.locale), sample),
      ]),
    ),
  ) as Record<PlatformTextType, string>;

  return (
    <div className="flex max-w-3xl flex-col gap-2">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <SmsSettingsView data={overview} previews={previews} defaults={defaults} businessName={tenant.name} />
    </div>
  );
}
