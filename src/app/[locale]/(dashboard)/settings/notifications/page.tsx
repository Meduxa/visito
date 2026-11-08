import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { NotificationsCard } from "@/features/settings/components/settings-view";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/notifications">) {
  return { title: (await sectionText((await params).locale, "notifications")).title };
}

// Settings → Notifications: who gets which alert under the bell (decision 021).
export default async function NotificationSettingsPage({
  params,
}: PageProps<"/[locale]/settings/notifications">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  const db = await createClient();
  const { data: s, error } = await db
    .from("tenant_settings")
    .select("notify_online_managers, notify_online_staff, notify_overdue_managers, notify_overdue_staff")
    .eq("tenant_id", tenant.tenantId)
    .single();
  if (error) throw new Error("Could not load settings");
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "notifications")} />
      <NotificationsCard
        initial={{
          onlineManagers: s.notify_online_managers,
          onlineStaff: s.notify_online_staff,
          overdueManagers: s.notify_overdue_managers,
          overdueStaff: s.notify_overdue_staff,
        }}
      />
    </div>
  );
}
