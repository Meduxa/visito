import { getBranchInfo } from "@/features/branches/queries";
import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ResourcesCard } from "@/features/settings/components/settings-view";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { createClient } from "@/lib/supabase/server";

type Resource = {
  id: string;
  name: string;
  type: "chair" | "room" | "equipment";
  location_id: string | null;
};

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/resources">) {
  return { title: (await sectionText((await params).locale, "resources")).title };
}

// Settings → Rooms & chairs (dental clinics only).
export default async function ResourcesSettingsPage({ params }: PageProps<"/[locale]/settings/resources">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale, "dental");
  const db = await createClient();
  const { data } = await db
    .from("resources")
    .select("id, name, type, location_id")
    .eq("tenant_id", tenant.tenantId)
    .order("sort_order")
    .order("name");
  const branches = (await getBranchInfo(db, tenant.tenantId)).usable.map((b) => ({ id: b.id, name: b.name }));
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "resources")} />
      <ResourcesCard
        resources={((data ?? []) as Resource[]).map((r) => ({ ...r, locationId: r.location_id }))}
        branches={branches}
      />
    </div>
  );
}
