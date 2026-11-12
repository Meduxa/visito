import { formatInTimeZone } from "date-fns-tz";
import { UserRound } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { MyDay } from "@/features/booking/components/my-day";
import { getCalendar } from "@/features/booking/queries";
import { MyTimeOff } from "@/features/timeoff/components/time-off-requests";
import { listTimeOffRequests } from "@/features/timeoff/queries";
import { addDays } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";
import { DEFAULT_TZ } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/my-day">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "myDay" });
  return { title: t("title") };
}

export default async function MyDayPage({ params }: PageProps<"/[locale]/my-day">) {
  setRequestLocale((await params).locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const supabase = await createClient();
  const [{ data: staffId }, { data: tz }] = await Promise.all([
    supabase.rpc("current_staff_id", { p_tenant: tenant.tenantId }),
    supabase.from("tenants").select("timezone").eq("id", tenant.tenantId).single(),
  ]);
  const t = await getTranslations("myDay");
  if (!staffId) {
    return <EmptyState icon={<UserRound />} title={t("title")} description={t("noProfile")} />;
  }

  const timeZone = tz?.timezone ?? DEFAULT_TZ;
  const today = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
  const data = await getCalendar(tenant.tenantId, addDays(today, -30), addDays(today, 14), {
    onlyStaffId: staffId,
  });
  const me = data.staff.find((s) => s.id === staffId);
  if (!me) return <EmptyState icon={<UserRound />} title={t("title")} description={t("noProfile")} />;

  // only bookings with an item of mine (owners/admins may see more)
  const mine = data.bookings.filter((b) => b.items.some((i) => i.staffId === staffId));
  const requests = await listTimeOffRequests(tenant.tenantId, { manager: false });
  return (
    <div className="flex flex-col gap-5">
      <MyDay bookings={mine} me={me} today={today} timeZone={timeZone} isDental={tenant.type === "dental"} />
      {/* time-off requests for my own profile (decision 029) */}
      <MyTimeOff requests={requests} today={today} />
    </div>
  );
}
