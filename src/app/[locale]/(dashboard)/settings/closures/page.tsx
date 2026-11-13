import { getBranchInfo } from "@/features/branches/queries";
import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ClosuresCard } from "@/features/settings/components/settings-view";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { ymdIn } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/closures">) {
  return { title: (await sectionText((await params).locale, "closures")).title };
}

// Settings → Closed days: holidays and other days the whole business is closed.
export default async function ClosuresSettingsPage({ params }: PageProps<"/[locale]/settings/closures">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  const db = await createClient();
  const { data: tz } = await db.from("tenants").select("timezone").eq("id", tenant.tenantId).single();
  const { data } = await db
    .from("closures")
    .select("id, date, reason, location_id")
    .eq("tenant_id", tenant.tenantId)
    .gte("date", ymdIn(new Date().toISOString(), tz?.timezone))
    .order("date");
  const branches = (await getBranchInfo(db, tenant.tenantId)).usable.map((b) => ({ id: b.id, name: b.name }));
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "closures")} />
      <ClosuresCard
        closures={(data ?? []).map((c) => ({
          id: c.id,
          date: c.date,
          reason: c.reason,
          locationId: c.location_id,
        }))}
        branches={branches}
      />
    </div>
  );
}
