import { formatInTimeZone } from "date-fns-tz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarScreen, type CalendarView } from "@/features/booking/components/calendar-view";
import type { CatalogEntry } from "@/features/booking/components/new-booking-panel";
import { getCalendar } from "@/features/booking/queries";
import { getBranchInfo, pickBranch } from "@/features/branches/queries";
import { listWaitlist } from "@/features/booking/waitlist-actions";
import { getCatalog } from "@/features/services/queries";
import { addDays, monthGrid, weekDates } from "@/lib/dates";
import { localized } from "@/lib/i18n-text";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { DEFAULT_TZ } from "@/lib/time";

const VIEWS = ["day", "week", "list", "month"] as const;

export async function generateMetadata({ params }: PageProps<"/[locale]/calendar">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "calendar" });
  return { title: t("title") };
}

export default async function CalendarPage({ params, searchParams }: PageProps<"/[locale]/calendar">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: tz }, { data: ownStaffId }, branchInfo] = await Promise.all([
    supabase.from("tenants").select("timezone").eq("id", tenant.tenantId).single(),
    supabase.rpc("current_staff_id", { p_tenant: tenant.tenantId }),
    getBranchInfo(supabase, tenant.tenantId),
  ]);
  // several branches: one at a time (?branch=<id>, else the main one) — decision 032
  const multi = branchInfo.usable.length > 1;
  const branch = multi ? pickBranch(branchInfo, typeof sp.branch === "string" ? sp.branch : null) : undefined;
  const timeZone = tz?.timezone ?? DEFAULT_TZ;
  const today = formatInTimeZone(new Date(), timeZone, "yyyy-MM-dd");
  const date = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const view = (VIEWS as readonly string[]).includes(sp.view as string) ? (sp.view as CalendarView) : null;
  const weekStaffId = typeof sp.staff === "string" && /^[0-9a-f-]{36}$/.test(sp.staff) ? sp.staff : null;
  // ?booking=<id> opens that booking's panel (links from notifications)
  const openBookingId =
    typeof sp.booking === "string" && /^[0-9a-f-]{36}$/.test(sp.booking) ? sp.booking : null;
  const isManager = canManage(tenant.role);
  // ?for=<client id>: "New booking" from the client card opens the booking form for that client (decision 026)
  const forId = typeof sp.for === "string" && /^[0-9a-f-]{36}$/.test(sp.for) ? sp.for : null;
  const bookFor = forId
    ? ((
        await supabase
          .from("clients")
          .select("id, first_name, last_name, phone_e164, important_note, no_show_count")
          .eq("tenant_id", tenant.tenantId)
          .eq("id", forId)
          .is("anonymized_at", null)
          .maybeSingle()
      ).data ?? null)
    : null;

  // Without an explicit view the client picks day (desktop) or list (phone): load both ranges.
  const [from, to] =
    view === "week"
      ? [weekDates(date)[0], weekDates(date)[6]]
      : view === "month"
        ? [monthGrid(date)[0], monthGrid(date).at(-1)!]
        : view === "day"
          ? [date, date]
          : [date, addDays(date, 6)];

  const [data, { categories, services }, links, waitlist, here] = await Promise.all([
    // staff see their own column only
    getCalendar(tenant.tenantId, from, to, {
      onlyStaffId: isManager ? undefined : (ownStaffId ?? "none"),
      branch: branch && { id: branch.id, isPrimary: branch.isPrimary },
    }),
    getCatalog(tenant.tenantId),
    supabase.from("staff_services").select("staff_id, service_id").eq("tenant_id", tenant.tenantId),
    listWaitlist(),
    branch
      ? supabase
          .from("service_locations")
          .select("service_id, offered, price_minor, price_max_minor")
          .eq("location_id", branch.id)
      : Promise.resolve({ data: [] }),
  ]);
  // this branch's own service settings: switched-off services left out, its prices shown
  const atBranch = new Map((here.data ?? []).map((x) => [x.service_id, x]));

  const catName = new Map(categories.map((c) => [c.id, localized(c.name, locale)]));
  const catalog: CatalogEntry[] = services
    .filter((s) => s.active && atBranch.get(s.id)?.offered !== false)
    .map((s) => ({
      id: s.id,
      name: s.name,
      categoryName: (s.categoryId && catName.get(s.categoryId)) || "—",
      durationMin: s.durationMin,
      priceType: s.priceType,
      priceMinor: atBranch.get(s.id)?.price_minor ?? s.priceMinor,
      priceMaxMinor:
        atBranch.get(s.id)?.price_minor != null ? atBranch.get(s.id)!.price_max_minor : s.priceMaxMinor,
      staffIds: (links.data ?? []).filter((l) => l.service_id === s.id).map((l) => l.staff_id),
    }));

  return (
    <CalendarScreen
      data={data}
      date={date}
      today={today}
      viewParam={view}
      weekStaffId={weekStaffId}
      openBookingId={openBookingId}
      tenantId={tenant.tenantId}
      catalog={catalog}
      isManager={isManager}
      isDental={tenant.type === "dental"}
      ownStaffId={ownStaffId ?? null}
      waitlist={waitlist}
      dayBy={sp.by === "chair" ? "chair" : "staff"}
      bookFor={bookFor}
      branches={multi ? branchInfo.usable.map((b) => ({ id: b.id, name: b.name })) : []}
      branchId={branch?.id ?? null}
    />
  );
}
