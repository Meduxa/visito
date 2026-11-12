import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SubscriptionView } from "@/features/billing/components/subscription-view";
import { loadBilling, paymentStatus } from "@/features/billing/queries";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/subscription">) {
  return { title: (await sectionText((await params).locale, "subscription")).title };
}

// Settings → Subscription (decision 031): the owner pays Visito by card and buys SMS packs.
export default async function SubscriptionPage({
  params,
  searchParams,
}: PageProps<"/[locale]/settings/subscription">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale, "owner");
  const sp = await searchParams;
  const order = typeof sp.order === "string" && /^[0-9a-f-]{36}$/.test(sp.order) ? sp.order : null;
  const [data, returned] = await Promise.all([
    loadBilling(tenant.tenantId),
    order ? paymentStatus(tenant.tenantId, order) : Promise.resolve(null),
  ]);
  return (
    <div className="flex max-w-4xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "subscription")} />
      <SubscriptionView data={data} returned={returned?.status ?? (order ? "processing" : null)} />
    </div>
  );
}
