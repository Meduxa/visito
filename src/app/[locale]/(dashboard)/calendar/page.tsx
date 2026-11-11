import { formatInTimeZone } from "date-fns-tz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CalendarScreen, type CalendarView } from "@/features/booking/components/calendar-view";
import type { CatalogEntry } from "@/features/booking/components/new-booking-panel";
import { getCalendar } from "@/features/booking/queries";
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

  const [{ data: tz }, { data: ownStaffId }] = await Promise.all([
    supabase.from("tenants").select("timezone").eq("id", tenant.tenantId).single(),
    supabase.rpc("current_staff_id", { p_tenant: tenant.tenantId }),
  ]);
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

  const [data, { categories, services }, links, waitlist] = await Promise.all([
    // staff see their own column only
    getCalendar(tenant.tenantId, from, to, { onlyStaffId: isManager ? undefined : (ownStaffId ?? "none") }),
    getCatalog(tenant.tenantId),
    supabase.from("staff_services").select("staff_id, service_id").eq("tenant_id", tenant.tenantId),
    listWaitlist(),
  ]);

  const catName = new Map(categories.map((c) => [c.id, localized(c.name, locale)]));
  const catalog: CatalogEntry[] = services
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      name: s.name,
      categoryName: (s.categoryId && catName.get(s.categoryId)) || "—",
      durationMin: s.durationMin,
      priceType: s.priceType,
      priceMinor: s.priceMinor,
      priceMaxMinor: s.priceMaxMinor,
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
    />
  );
}
