import "server-only";
import { createClient } from "@/lib/supabase/server";
import { trimSeconds } from "@/lib/time";

export type StaffMember = {
  id: string;
  displayName: string;
  position: string | null;
  positionType: "master" | "doctor" | "assistant" | "other";
  color: string;
  photoUrl: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  bookableOnline: boolean;
  active: boolean;
  commissionPct: number;
  serviceCount: number;
  workDays: number[]; // weekdays with at least one interval
  linkedMembershipId: string | null;
};

export type StaffDetail = StaffMember & {
  services: { serviceId: string; priceMinorOverride: number | null; durationMinOverride: number | null }[];
  week: Record<number, { start: string; end: string; locationId?: string }[]>;
  overrides: {
    id: string;
    date: string;
    dayOff: boolean;
    start: string | null;
    end: string | null;
    locationId: string | null;
  }[];
  timeOff: { id: string; startsAt: string; endsAt: string; reason: string; note: string | null }[];
};

type Row = {
  id: string;
  display_name: string;
  position: string | null;
  position_type: string;
  color: string;
  photo_path: string | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  bookable_online: boolean;
  active: boolean;
  commission_pct: number;
};

function base(
  r: Row,
  supabaseUrl: string,
): Omit<StaffMember, "serviceCount" | "workDays" | "linkedMembershipId"> {
  return {
    id: r.id,
    displayName: r.display_name,
    position: r.position,
    positionType: r.position_type as StaffMember["positionType"],
    color: r.color,
    photoUrl: r.photo_path ? `${supabaseUrl}/storage/v1/object/public/staff-photos/${r.photo_path}` : null,
    phone: r.phone,
    email: r.email,
    bio: r.bio,
    bookableOnline: r.bookable_online,
    active: r.active,
    commissionPct: Number(r.commission_pct),
  };
}

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL!;

export async function getStaffList(tenantId: string): Promise<StaffMember[]> {
  const supabase = await createClient();
  const [staff, links] = await Promise.all([
    supabase
      .from("staff")
      .select("*, staff_services(count), staff_schedules(weekday)")
      .eq("tenant_id", tenantId)
      .order("sort_order")
      .order("display_name"),
    supabase.from("memberships").select("id, staff_id").eq("tenant_id", tenantId).not("staff_id", "is", null),
  ]);
  if (staff.error) throw new Error("Could not load staff");
  const linkOf = new Map((links.data ?? []).map((m) => [m.staff_id, m.id]));

  return staff.data.map((s) => ({
    ...base(s, url()),
    serviceCount: (s.staff_services as unknown as { count: number }[])[0]?.count ?? 0,
    workDays: [...new Set(s.staff_schedules.map((x) => x.weekday))].sort(),
    linkedMembershipId: linkOf.get(s.id) ?? null,
  }));
}

export async function getStaffDetail(tenantId: string, staffId: string): Promise<StaffDetail | null> {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [s, services, week, overrides, timeOff, link] = await Promise.all([
    supabase.from("staff").select("*").eq("tenant_id", tenantId).eq("id", staffId).maybeSingle(),
    supabase
      .from("staff_services")
      .select("service_id, price_minor_override, duration_min_override")
      .eq("staff_id", staffId),
    supabase
      .from("staff_schedules")
      .select("weekday, start_time, end_time, location_id")
      .eq("staff_id", staffId)
      .order("start_time"),
    supabase
      .from("staff_schedule_overrides")
      .select("id, date, is_day_off, start_time, end_time, location_id")
      .eq("staff_id", staffId)
      .gte("date", today)
      .order("date"),
    supabase
      .from("time_off")
      .select("id, starts_at, ends_at, reason, note")
      .eq("staff_id", staffId)
      .gte("ends_at", new Date().toISOString())
      .order("starts_at"),
    supabase.from("memberships").select("id").eq("tenant_id", tenantId).eq("staff_id", staffId).maybeSingle(),
  ]);
  if (!s.data) return null;

  const weekMap: StaffDetail["week"] = {};
  for (const w of week.data ?? []) {
    (weekMap[w.weekday] ??= []).push({
      start: trimSeconds(w.start_time),
      end: trimSeconds(w.end_time),
      ...(w.location_id ? { locationId: w.location_id } : {}),
    });
  }

  return {
    ...base(s.data, url()),
    serviceCount: services.data?.length ?? 0,
    workDays: Object.keys(weekMap).map(Number),
    linkedMembershipId: link.data?.id ?? null,
    services: (services.data ?? []).map((x) => ({
      serviceId: x.service_id,
      priceMinorOverride: x.price_minor_override,
      durationMinOverride: x.duration_min_override,
    })),
    week: weekMap,
    overrides: (overrides.data ?? []).map((o) => ({
      id: o.id,
      date: o.date,
      dayOff: o.is_day_off,
      start: o.start_time && trimSeconds(o.start_time),
      end: o.end_time && trimSeconds(o.end_time),
      locationId: o.location_id,
    })),
    timeOff: (timeOff.data ?? []).map((t) => ({
      id: t.id,
      startsAt: t.starts_at,
      endsAt: t.ends_at,
      reason: t.reason,
      note: t.note,
    })),
  };
}

// Team members who can be linked to a staff profile (for the "login" picker).
export async function getLinkableMembers(tenantId: string) {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("memberships")
    .select("id, user_id, role, staff_id")
    .eq("tenant_id", tenantId);
  const ids = (members ?? []).map((m) => m.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };
  const name = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  return (members ?? []).map((m) => ({
    id: m.id,
    name: name.get(m.user_id) || "—",
    role: m.role,
    staffId: m.staff_id,
  }));
}
