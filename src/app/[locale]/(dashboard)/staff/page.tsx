import { getTranslations, setRequestLocale } from "next-intl/server";
import { StaffList } from "@/features/staff/components/staff-list";
import { getStaffList } from "@/features/staff/queries";
import { TimeOffInbox } from "@/features/timeoff/components/time-off-requests";
import { listTimeOffRequests } from "@/features/timeoff/queries";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/staff">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "staff" });
  return { title: t("title") };
}

export default async function StaffPage({ params }: PageProps<"/[locale]/staff">) {
  setRequestLocale((await params).locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const manager = canManage(tenant.role);
  const [staff, requests] = await Promise.all([
    getStaffList(tenant.tenantId),
    manager ? listTimeOffRequests(tenant.tenantId, { manager: true }) : Promise.resolve([]),
  ]);
  return (
    <StaffList
      staff={staff}
      canManage={manager}
      isDental={tenant.type === "dental"}
      // time-off requests waiting for owner/admin (decision 029)
      top={manager ? <TimeOffInbox requests={requests} /> : null}
    />
  );
}
