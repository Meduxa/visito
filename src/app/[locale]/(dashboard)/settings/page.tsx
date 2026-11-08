import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SettingsList } from "@/features/settings/components/settings-nav";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" });
  return { title: t("settings") };
}

// Settings home: every section with a line about what is inside.
export default async function SettingsHome({ params }: PageProps<"/[locale]/settings">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant) redirect(`/${locale}/dashboard`);
  if (!canManage(tenant.role)) redirect(`/${locale}/settings/team`);
  const t = await getTranslations();
  return (
    <div className="flex max-w-3xl flex-col">
      <PageHeader title={t("nav.settings")} description={t("settings.subtitle")} />
      <SettingsList isOwner={tenant.role === "owner"} isDental={tenant.type === "dental"} />
    </div>
  );
}
