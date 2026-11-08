import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ResourcesCard } from "@/features/settings/components/settings-view";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { createClient } from "@/lib/supabase/server";

type Resource = { id: string; name: string; type: "chair" | "room" | "equipment" };

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
    .select("id, name, type")
    .eq("tenant_id", tenant.tenantId)
    .order("sort_order")
    .order("name");
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "resources")} />
      <ResourcesCard resources={(data ?? []) as Resource[]} />
    </div>
  );
}
