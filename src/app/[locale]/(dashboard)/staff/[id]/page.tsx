import { notFound, redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getBranchInfo } from "@/features/branches/queries";
import { getCatalog } from "@/features/services/queries";
import { StaffDetailView } from "@/features/staff/components/staff-detail";
import { getLinkableMembers, getStaffDetail } from "@/features/staff/queries";
import { localized } from "@/lib/i18n-text";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { DEFAULT_TZ, trimSeconds } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/staff/[id]">) {
  const { id } = await params;
  const tenant = await getActiveTenant();
  if (!tenant || !/^[0-9a-f-]{36}$/.test(id)) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("staff")
    .select("display_name")
    .eq("id", id)
    .eq("tenant_id", tenant.tenantId)
    .maybeSingle();
  return { title: data?.display_name };
}

export default async function StaffDetailPage({ params }: PageProps<"/[locale]/staff/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  // Staff members see the list; editing a profile is for owner/admin.
  if (!canManage(tenant.role)) redirect(`/${locale}/staff`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();

  const supabase = await createClient();
  const [staff, { categories, services }, members, { data: t }, branches, { data: hours }] =
    await Promise.all([
      getStaffDetail(tenant.tenantId, id),
      getCatalog(tenant.tenantId),
      getLinkableMembers(tenant.tenantId),
      supabase.from("tenants").select("timezone").eq("id", tenant.tenantId).single(),
      getBranchInfo(supabase, tenant.tenantId),
      supabase
        .from("location_hours")
        .select("location_id, weekday, start_time, end_time")
        .eq("tenant_id", tenant.tenantId),
    ]);
  // each branch's opening hours, for the "outside opening hours" warning
  const openHours: Record<string, Record<number, { start: string; end: string }[]>> = {};
  for (const h of hours ?? []) {
    const byDay = (openHours[h.location_id] ??= {});
    (byDay[h.weekday] ??= []).push({ start: trimSeconds(h.start_time), end: trimSeconds(h.end_time) });
  }
  if (!staff) notFound();

  const catName = new Map(categories.map((c) => [c.id, localized(c.name, locale)]));
  const catalog = services
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      name: s.name,
      priceType: s.priceType,
      priceMinor: s.priceMinor,
      priceMaxMinor: s.priceMaxMinor,
      durationMin: s.durationMin,
      categoryName: (s.categoryId && catName.get(s.categoryId)) || "—",
    }));

  return (
    <StaffDetailView
      staff={staff}
      tenantId={tenant.tenantId}
      timeZone={t?.timezone ?? DEFAULT_TZ}
      isDental={tenant.type === "dental"}
      catalog={catalog}
      members={members}
      branches={branches.usable.map((b) => ({ id: b.id, name: b.name }))}
      openHours={openHours}
    />
  );
}
