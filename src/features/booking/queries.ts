import "server-only";
import { addDays } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { workingRanges, type HM } from "./engine/availability";
import { fromZonedTime } from "date-fns-tz";
import { dateParts } from "@/lib/dates";
import { loadEngineData } from "./load-data";

export type CalItem = {
  id: string;
  staffId: string;
  resourceId: string | null;
  serviceId: string | null;
  serviceColor: string | null; // the service's own colour, if set
  name: string;
  priceMinor: number;
  priceType: string;
  durationMin: number;
  start: string;
  end: string;
};

export type CalBooking = {
  id: string;
  status: string;
  source: string;
  recurrenceId: string | null;
  start: string;
  end: string;
  note: string | null;
  clientComment: string | null; // typed by the client on the booking page
  totalMinor: number;
  paidMinor: number;
  client: {
    id: string;
    name: string;
    phone: string | null;
    importantNote: string | null;
    noShows: number;
  } | null;
  items: CalItem[];
};

export type CalStaff = {
  id: string;
  name: string;
  position: string | null;
  color: string;
  photoUrl: string | null;
};

export type CalendarData = {
  timeZone: string;
  slotStepMin: number;
  dayStartMin: number; // grid range in local minutes
  dayEndMin: number;
  staff: CalStaff[];
  bookings: CalBooking[];
  // per "staffId|date": working ranges and time off as [startMs, endMs]
  working: Record<string, [number, number][]>;
  timeOff: Record<string, [number, number][]>;
  // chairs/rooms (dental) and the business opening hours per date, for the chair view
  resources: { id: string; name: string; type: string }[];
  opening: Record<string, [number, number][]>;
};

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export async function getCalendar(
  tenantId: string,
  from: string,
  to: string,
  // branch: only that branch's bookings, rooms and people working there (decision 032)
  opts: { onlyStaffId?: string; branch?: { id: string; isPrimary: boolean } } = {},
): Promise<CalendarData> {
  const supabase = await createClient();
  const engine = await loadEngineData(supabase, tenantId, from, to, { locationId: opts.branch?.id });
  const branch = opts.branch;
  // bookings without a branch (made before branches existed) belong to the main one
  const inBranch = branch
    ? branch.isPrimary
      ? `location_id.eq.${branch.id},location_id.is.null`
      : `location_id.eq.${branch.id}`
    : null;
  const fromIso = new Date(`${from}T00:00:00Z`).getTime() - 14 * 3_600_000; // generous; filtered by local date in the UI
  const toIso = new Date(`${addDays(to, 1)}T00:00:00Z`).getTime() + 14 * 3_600_000;

  const [{ data: staffRows }, { data: rows, error }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, display_name, position, color, photo_path, active")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("sort_order")
      .order("display_name"),
    (() => {
      const q = supabase
        .from("bookings")
        .select(
          "id, status, source, recurrence_id, starts_at, ends_at, internal_note, client_comment, total_minor, paid_minor, clients(id, first_name, last_name, phone_e164, important_note, no_show_count), booking_items(id, staff_id, resource_id, service_id, name_snapshot, price_minor_snapshot, price_type_snapshot, duration_min_snapshot, starts_at, ends_at, sort_order, services(color))",
        )
        .eq("tenant_id", tenantId)
        .lt("starts_at", new Date(toIso).toISOString())
        .gt("ends_at", new Date(fromIso).toISOString())
        .order("starts_at");
      return inBranch ? q.or(inBranch) : q;
    })(),
  ]);
  if (error) throw new Error("Could not load calendar");

  // With branches: the people who work in this branch in these days or have a visit here
  // (everyone if nobody does yet, so the calendar is never empty).
  const here = new Set<string>();
  if (branch) {
    for (const b of rows ?? []) for (const i of b.booking_items) here.add(i.staff_id);
    for (let d = from; d <= to; d = addDays(d, 1))
      for (const s of engine.staff) if (workingRanges(s, d, engine).length) here.add(s.id);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const staff: CalStaff[] = (staffRows ?? [])
    .filter((s) => !opts.onlyStaffId || s.id === opts.onlyStaffId)
    .filter((s) => !branch || here.size === 0 || here.has(s.id))
    .map((s) => ({
      id: s.id,
      name: s.display_name,
      position: s.position,
      color: s.color,
      photoUrl: s.photo_path ? `${url}/storage/v1/object/public/staff-photos/${s.photo_path}` : null,
    }));

  const working: CalendarData["working"] = {};
  const timeOff: CalendarData["timeOff"] = {};
  for (let d = from; d <= to; d = addDays(d, 1)) {
    for (const s of engine.staff) {
      working[`${s.id}|${d}`] = workingRanges(s, d, engine).map((r) => [r[0], r[1]]);
      timeOff[`${s.id}|${d}`] = s.timeOff.map((r) => [r[0], r[1]]);
    }
  }

  // Grid hours: from the earliest opening to the latest closing (8–20 if none).
  const opening: CalendarData["opening"] = {};
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const list: HM[] = engine.closures.includes(d) ? [] : (engine.openingHours[dateParts(d).weekday] ?? []);
    opening[d] = list.map((h) => [
      fromZonedTime(`${d}T${h.start}`, engine.timeZone).getTime(),
      fromZonedTime(`${d}T${h.end}`, engine.timeZone).getTime(),
    ]);
  }
  const resourceQuery = supabase
    .from("resources")
    .select("id, name, type")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("sort_order")
    .order("name");
  const { data: resourceRows } = await (inBranch ? resourceQuery.or(inBranch) : resourceQuery);

  const all = Object.values(engine.openingHours).flat();
  const dayStartMin = all.length ? Math.min(...all.map((h) => toMin(h.start))) : 8 * 60;
  const dayEndMin = all.length ? Math.max(...all.map((h) => toMin(h.end))) : 20 * 60;

  const bookings: CalBooking[] = (rows ?? []).map((b) => {
    const c = b.clients as unknown as {
      id: string;
      first_name: string;
      last_name: string | null;
      phone_e164: string | null;
      important_note: string | null;
      no_show_count: number;
    } | null;
    return {
      id: b.id,
      status: b.status,
      source: b.source,
      recurrenceId: b.recurrence_id,
      start: b.starts_at,
      end: b.ends_at,
      note: b.internal_note,
      clientComment: b.client_comment,
      totalMinor: b.total_minor,
      paidMinor: b.paid_minor,
      client: c
        ? {
            id: c.id,
            name: [c.first_name, c.last_name].filter(Boolean).join(" "),
            phone: c.phone_e164,
            importantNote: c.important_note,
            noShows: c.no_show_count,
          }
        : null,
      items: [...b.booking_items]
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((i) => ({
          id: i.id,
          staffId: i.staff_id,
          resourceId: i.resource_id,
          serviceId: i.service_id,
          serviceColor: i.services?.color ?? null,
          name: i.name_snapshot,
          priceMinor: i.price_minor_snapshot,
          priceType: i.price_type_snapshot,
          durationMin: i.duration_min_snapshot,
          start: i.starts_at,
          end: i.ends_at,
        })),
    };
  });

  return {
    timeZone: engine.timeZone,
    slotStepMin: engine.rules.slotStepMin,
    dayStartMin: Math.max(0, Math.floor(dayStartMin / 60) * 60),
    dayEndMin: Math.min(24 * 60, Math.ceil(dayEndMin / 60) * 60),
    staff,
    bookings,
    working,
    timeOff,
    resources: resourceRows ?? [],
    opening,
  };
}
