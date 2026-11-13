// Free slots for a booking request. PURE: all data comes in, slots come out.
// Rules: booking-engine skill §2. Times are built in the business's time zone
// (never a fixed +4) and compared as absolute instants.
import { addDays, differenceInCalendarDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { contains, intersect, MIN, overlapsAny, subtract, type Range } from "./intervals";

export type HM = { start: string; end: string }; // "HH:MM" local
// A working interval and the branch it is in (undefined = any branch, e.g. one-branch businesses)
export type WorkHM = HM & { locationId?: string };

export type StaffData = {
  id: string;
  sortOrder: number;
  active: boolean;
  bookableOnline: boolean;
  week: Record<number, WorkHM[]>; // 1 = Monday … 7 = Sunday
  overrides: Record<string, { dayOff: true } | { intervals: WorkHM[] }>; // by local date
  timeOff: Range[];
  busy: Range[]; // active booking items, start → blocked_until (buffer included)
  services: Record<string, { durationMin: number | null }>; // what they perform; own duration if set
};

export type ResourceData = { id: string; type: string; sortOrder: number; busy: Range[] };

export type ServiceRequest = {
  serviceId: string;
  durationMin: number; // service or chosen variant
  bufferMin: number;
  resourceType: string | null;
  bookableOnline: boolean;
  addonMin?: number;
};

export type EngineData = {
  timeZone: string;
  now: Date;
  rules: { minNoticeMin: number; maxDaysAhead: number; slotStepMin: number };
  // The branch being booked (decision 032): only intervals there count. Opening
  // hours, closures and resources passed in are already that branch's.
  locationId?: string | null;
  notOffered?: string[]; // services switched off at this branch
  openingHours: Record<number, HM[]>;
  closures: string[]; // local dates "yyyy-MM-dd"
  staff: StaffData[];
  resources: ResourceData[];
};

export type SlotRequest = {
  dates: string[]; // local dates
  services: ServiceRequest[];
  staffId: string | "any";
  online?: boolean; // public booking page: only bookable_online services/staff, notice rules
};

export type Slot = { start: Date; end: Date; staffId: string; resourceId: string | null };

const weekday = (date: string, tz: string) =>
  Number(formatInTimeZone(fromZonedTime(`${date}T12:00`, tz), tz, "i"));

function dayRanges(date: string, list: HM[] | undefined, tz: string): Range[] {
  return (list ?? []).map((i) => [
    fromZonedTime(`${date}T${i.start}`, tz).getTime(),
    fromZonedTime(`${date}T${i.end}`, tz).getTime(),
  ]);
}

const atBranch = (list: WorkHM[] | undefined, loc: string | null | undefined) =>
  !loc ? list : list?.filter((i) => !i.locationId || i.locationId === loc);

// When this staff member works on that local date at the branch, inside its
// opening hours, minus time off. A date change replaces the whole day (all branches).
export function workingRanges(staff: StaffData, date: string, data: EngineData): Range[] {
  if (data.closures.includes(date)) return [];
  const tz = data.timeZone;
  const wd = weekday(date, tz);
  const open = dayRanges(date, data.openingHours[wd], tz);
  const o = staff.overrides[date];
  const own = o
    ? "dayOff" in o
      ? []
      : dayRanges(date, atBranch(o.intervals, data.locationId), tz)
    : dayRanges(date, atBranch(staff.week[wd], data.locationId), tz);
  return subtract(intersect(open, own), staff.timeOff);
}

// Total time for these services when done by this person (own duration →
// variant/base), plus add-ons; the break applies after the last service.
export function totalFor(
  staff: StaffData,
  services: ServiceRequest[],
): { durationMin: number; bufferMin: number } | null {
  let duration = 0;
  for (const s of services) {
    const own = staff.services[s.serviceId];
    if (!own) return null;
    duration += (own.durationMin ?? s.durationMin) + (s.addonMin ?? 0);
  }
  return { durationMin: duration, bufferMin: services.at(-1)?.bufferMin ?? 0 };
}

function freeResource(data: EngineData, type: string, block: Range): string | null {
  const r = data.resources
    .filter((x) => x.type === type)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((x) => !overlapsAny(block, x.busy));
  return r?.id ?? null;
}

function slotsForStaff(staff: StaffData, req: SlotRequest, data: EngineData): Slot[] {
  if (!staff.active || (req.online && !staff.bookableOnline)) return [];
  if (req.online && req.services.some((s) => !s.bookableOnline)) return [];
  if (req.services.some((s) => data.notOffered?.includes(s.serviceId))) return [];
  const total = totalFor(staff, req.services);
  if (!total) return [];

  const tz = data.timeZone;
  const step = data.rules.slotStepMin * MIN;
  const earliest = data.now.getTime() + (req.online ? data.rules.minNoticeMin * MIN : 0);
  const today = formatInTimeZone(data.now, tz, "yyyy-MM-dd");
  const resourceType = req.services.find((s) => s.resourceType)?.resourceType ?? null;
  const out: Slot[] = [];

  for (const date of req.dates) {
    const ahead = differenceInCalendarDays(new Date(`${date}T00:00:00Z`), new Date(`${today}T00:00:00Z`));
    // "max days ahead" limits clients online; admins may plan further (treatment courses)
    if (ahead < 0 || (req.online && ahead > data.rules.maxDaysAhead)) continue;
    const midnight = fromZonedTime(`${date}T00:00`, tz).getTime();

    for (const [ws, we] of workingRanges(staff, date, data)) {
      // start times snap to the step, counted from local midnight
      let t = midnight + Math.ceil((ws - midnight) / step) * step;
      for (; t + total.durationMin * MIN <= we; t += step) {
        if (t < earliest) continue;
        const end = t + total.durationMin * MIN;
        const block: Range = [t, end + total.bufferMin * MIN];
        if (overlapsAny(block, staff.busy)) continue;
        let resourceId: string | null = null;
        if (resourceType) {
          resourceId = freeResource(data, resourceType, block);
          if (!resourceId) continue;
        }
        out.push({ start: new Date(t), end: new Date(end), staffId: staff.id, resourceId });
      }
    }
  }
  return out;
}

const bookedMinutes = (staff: StaffData, date: string, tz: string) => {
  const day: Range = [
    fromZonedTime(`${date}T00:00`, tz).getTime(),
    fromZonedTime(`${addDaysStr(date, 1)}T00:00`, tz).getTime(),
  ];
  return staff.busy.reduce((sum, [s, e]) => sum + Math.max(0, Math.min(e, day[1]) - Math.max(s, day[0])), 0);
};

export const addDaysStr = (date: string, n: number) =>
  addDays(new Date(`${date}T12:00:00Z`), n)
    .toISOString()
    .slice(0, 10);

export function getAvailableSlots(req: SlotRequest, data: EngineData): Slot[] {
  if (req.staffId !== "any") {
    const staff = data.staff.find((s) => s.id === req.staffId);
    return staff ? slotsForStaff(staff, req, data) : [];
  }
  // "Any staff": one option per start time; the least busy person that day
  // gets it (load balancing), ties broken by staff order.
  const byStart = new Map<number, { slot: Slot; load: number; order: number }>();
  for (const staff of data.staff) {
    for (const slot of slotsForStaff(staff, req, data)) {
      const date = formatInTimeZone(slot.start, data.timeZone, "yyyy-MM-dd");
      const load = bookedMinutes(staff, date, data.timeZone);
      const key = slot.start.getTime();
      const current = byStart.get(key);
      if (!current || load < current.load || (load === current.load && staff.sortOrder < current.order)) {
        byStart.set(key, { slot, load, order: staff.sortOrder });
      }
    }
  }
  return [...byStart.values()].map((x) => x.slot).sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type Conflict = "closed" | "outsideHours" | "overlap" | "cannotPerform" | "noResource" | "inactive";

// Why a specific time does not work (admin calendar). Empty list = OK.
export function validateBooking(
  draft: { staffId: string; start: Date; services: ServiceRequest[] },
  data: EngineData,
): Conflict[] {
  const staff = data.staff.find((s) => s.id === draft.staffId);
  if (!staff || !staff.active) return ["inactive"];
  const total = totalFor(staff, draft.services);
  if (!total || draft.services.some((s) => data.notOffered?.includes(s.serviceId))) return ["cannotPerform"];
  const date = formatInTimeZone(draft.start, data.timeZone, "yyyy-MM-dd");
  const start = draft.start.getTime();
  const end = start + total.durationMin * MIN;
  const conflicts: Conflict[] = [];
  if (data.closures.includes(date)) conflicts.push("closed");
  else if (!workingRanges(staff, date, data).some((r) => contains(r, [start, end])))
    conflicts.push("outsideHours");
  const block: Range = [start, end + total.bufferMin * MIN];
  if (overlapsAny(block, staff.busy)) conflicts.push("overlap");
  const type = draft.services.find((s) => s.resourceType)?.resourceType;
  if (type && !freeResource(data, type, block)) conflicts.push("noResource");
  return conflicts;
}
