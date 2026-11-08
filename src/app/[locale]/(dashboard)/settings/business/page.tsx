import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { BusinessCard, HoursCard } from "@/features/settings/components/settings-view";
import type { Week } from "@/components/week-editor";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { createClient } from "@/lib/supabase/server";
import { trimSeconds } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/business">) {
  return { title: (await sectionText((await params).locale, "business")).title };
}

// Settings → Business: contact details and opening hours.
export default async function BusinessSettingsPage({ params }: PageProps<"/[locale]/settings/business">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  const db = await createClient();
  const [settings, location] = await Promise.all([
    db.from("tenant_settings").select("phone, email").eq("tenant_id", tenant.tenantId).single(),
    db
      .from("locations")
      .select("address, location_hours(weekday, start_time, end_time)")
      .eq("tenant_id", tenant.tenantId)
      .eq("is_primary", true)
      .single(),
  ]);
  if (settings.error || location.error) throw new Error("Could not load settings");
  const hours: Week = {};
  for (const h of [...location.data.location_hours].sort((a, b) => a.start_time.localeCompare(b.start_time)))
    (hours[h.weekday] ??= []).push({ start: trimSeconds(h.start_time), end: trimSeconds(h.end_time) });

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "business")} />
      <BusinessCard
        isOwner={tenant.role === "owner"}
        initial={{
          name: tenant.name,
          address: location.data.address ?? "",
          phone: settings.data.phone ?? "",
          email: settings.data.email ?? "",
        }}
      />
      <HoursCard initial={hours} />
    </div>
  );
}
