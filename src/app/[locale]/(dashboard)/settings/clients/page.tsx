import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ClientFieldsCard, SegmentRulesCard } from "@/features/clients/components/client-settings";
import { getSegmentRules, listClientFields } from "@/features/clients/queries";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/clients">) {
  return { title: (await sectionText((await params).locale, "clients")).title };
}

// Settings → Clients (decision 026): own client fields and the automatic groups' numbers.
export default async function ClientSettingsPage({ params }: PageProps<"/[locale]/settings/clients">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  const [fields, rules] = await Promise.all([
    listClientFields(tenant.tenantId),
    getSegmentRules(tenant.tenantId),
  ]);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "clients")} />
      <ClientFieldsCard fields={fields} />
      <SegmentRulesCard rules={rules} />
    </div>
  );
}
