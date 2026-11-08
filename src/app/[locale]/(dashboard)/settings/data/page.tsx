import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { AccountCard } from "@/features/settings/components/account-card";
import { SupportCard } from "@/features/settings/components/support-card";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { fullDate, fullDateTime, ymdIn } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/data">) {
  return { title: (await sectionText((await params).locale, "data")).title };
}

// Settings → Data & security (owner only): support access, export, audit log,
// sign out everywhere, deleting the business.
export default async function DataSettingsPage({ params }: PageProps<"/[locale]/settings/data">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale, "owner");
  const t = await getTranslations();
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "data")} />
      <SupportCard until={await supportUntil(tenant.tenantId)} />
      <AccountCard
        businessName={tenant.name}
        deletionDue={tenant.deletionDueAt ? fullDate(t, ymdIn(tenant.deletionDueAt)) : null}
      />
    </div>
  );
}

// the open support consent, as a date and time in the business's language
async function supportUntil(tenantId: string) {
  const db = await createClient();
  const [{ data }, { data: tz }, t] = await Promise.all([
    db
      .from("support_grants")
      .select("expires_at")
      .eq("tenant_id", tenantId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("tenants").select("timezone").eq("id", tenantId).single(),
    getTranslations(),
  ]);
  return data ? fullDateTime(t, data.expires_at, tz?.timezone) : null;
}
