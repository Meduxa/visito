// The booking-engine skill's required tests (§7). #14 (concurrency) runs
// against the database in supabase/tests/rls_bookings.test.ts.
import { describe, expect, it } from "vitest";
import {
  getAvailableSlots,
  validateBooking,
  type EngineData,
  type ServiceRequest,
  type StaffData,
} from "./availability";

const TZ = "Asia/Tbilisi";
const MON = "2031-03-03"; // a Monday
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+04:00`).getTime();
const hhmm = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const WEEK = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((d) => [d, [{ start: "10:00", end: "19:00" }]]));

function staff(id: string, patch: Partial<StaffData> = {}): StaffData {
  return {
    id,
    sortOrder: 0,
    active: true,
    bookableOnline: true,
    week: WEEK,
    overrides: {},
    timeOff: [],
    busy: [],
    services: { cut: { durationMin: null }, colour: { durationMin: null } },
    ...patch,
  };
}

const cut: ServiceRequest = {
  serviceId: "cut",
  durationMin: 60,
  bufferMin: 0,
  resourceType: null,
  bookableOnline: true,
};
const colour: ServiceRequest = {
  serviceId: "colour",
  durationMin: 90,
  bufferMin: 15,
  resourceType: null,
  bookableOnline: true,
};

function data(patch: Partial<EngineData> = {}): EngineData {
  return {
    timeZone: TZ,
    now: new Date("2031-03-01T08:00:00Z"),
    rules: { minNoticeMin: 120, maxDaysAhead: 60, slotStepMin: 15 },
    openingHours: WEEK,
    closures: [],
    staff: [staff("ana")],
    resources: [],
    ...patch,
  };
}

const starts = (d: EngineData, services = [cut], staffId = "ana", date = MON, online = false) =>
  getAvailableSlots({ dates: [date], services, staffId, online }, d).map((s) => hhmm(s.start));

describe("availability", () => {
  it("1. simple day 10–19, 60 min service, step 15: first 10:00, last 18:00", () => {
    const s = starts(data());
    expect(s[0]).toBe("10:00");
    expect(s.at(-1)).toBe("18:00");
    expect(s).toHaveLength(33);
  });

  it("2. split shift with a lunch break", () => {
    const d = data({
      staff: [
        staff("ana", {
          week: {
            1: [
              { start: "10:00", end: "14:00" },
              { start: "15:00", end: "19:00" },
            ],
          },
        }),
      ],
    });
    const s = starts(d);
    expect(s).toContain("13:00");
    expect(s).not.toContain("13:15");
    expect(s).not.toContain("14:30");
    expect(s).toContain("15:00");
  });

  it("3. a date override replaces the weekly schedule; day off → no slots", () => {
    const short = data({
      staff: [staff("ana", { overrides: { [MON]: { intervals: [{ start: "12:00", end: "14:00" }] } } })],
    });
    expect(starts(short)).toEqual(["12:00", "12:15", "12:30", "12:45", "13:00"]);
    const off = data({ staff: [staff("ana", { overrides: { [MON]: { dayOff: true } } })] });
    expect(starts(off)).toEqual([]);
  });

  it("4. time off in the middle of the day", () => {
    const d = data({ staff: [staff("ana", { timeOff: [[at(MON, "12:00"), at(MON, "13:00")]] })] });
    const s = starts(d);
    expect(s).toContain("11:00");
    expect(s).not.toContain("11:15");
    expect(s).toContain("13:00");
  });

  it("5. an existing booking plus its break blocks the right range", () => {
    // booked 12:00–13:30 + 15 min break → blocked until 13:45
    const d = data({ staff: [staff("ana", { busy: [[at(MON, "12:00"), at(MON, "13:45")]] })] });
    const s = starts(d);
    expect(s).toContain("11:00");
    expect(s).not.toContain("11:15");
    expect(s).not.toContain("13:30");
    expect(s).toContain("13:45");
  });

  it("5b. the new booking's own break must not run into the next booking", () => {
    const d = data({ staff: [staff("ana", { busy: [[at(MON, "15:00"), at(MON, "16:00")]] })] });
    // colour: 90 min + 15 break → must end its break by 15:00 → latest start 13:15
    const s = starts(d, [colour]);
    expect(s).toContain("13:15");
    expect(s).not.toContain("13:30");
  });

  it("6. cancelled and no-show bookings do not block (the loader passes only active items)", () => {
    expect(starts(data({ staff: [staff("ana", { busy: [] })] }))).toContain("12:00");
  });

  it("7. multi-service total with a per-staff duration", () => {
    const fast = staff("ana", { services: { cut: { durationMin: 30 }, colour: { durationMin: null } } });
    // 30 (own cut) + 90 (colour) = 120 min → last start 17:00
    expect(starts(data({ staff: [fast] }), [cut, colour]).at(-1)).toBe("17:00");
  });

  it("8. staff who cannot do one of the services is excluded", () => {
    const d = data({ staff: [staff("ana", { services: { cut: { durationMin: null } } }), staff("eka")] });
    expect(starts(d, [cut, colour], "ana")).toEqual([]);
    expect(starts(d, [cut, colour], "eka").length).toBeGreaterThan(0);
  });

  it("9. resource busy → slot unavailable even if staff is free", () => {
    const chairCut = { ...cut, resourceType: "chair" };
    const d = data({
      resources: [{ id: "c1", type: "chair", sortOrder: 0, busy: [[at(MON, "10:00"), at(MON, "12:00")]] }],
    });
    const s = getAvailableSlots({ dates: [MON], services: [chairCut], staffId: "ana" }, d);
    expect(hhmm(s[0].start)).toBe("12:00");
    expect(s[0].resourceId).toBe("c1");
    expect(starts(data({ resources: [] }), [chairCut])).toEqual([]);
  });

  it("10. min notice and max days ahead (online)", () => {
    const now = new Date(`${MON}T07:00:00Z`); // 11:00 local
    const s = starts(data({ now }), [cut], "ana", MON, true);
    expect(s[0]).toBe("13:00"); // 11:00 + 2 h notice
    const far = "2031-06-30";
    expect(starts(data({ now }), [cut], "ana", far, true)).toEqual([]);
    expect(starts(data({ now }), [cut], "ana", far, false).length).toBeGreaterThan(0); // admins may plan further
  });

  it("11. 'any staff' returns one option per time and load-balances", () => {
    const busyAna = staff("ana", { sortOrder: 0, busy: [[at(MON, "10:00"), at(MON, "12:00")]] });
    const eka = staff("eka", { sortOrder: 1 });
    const s = getAvailableSlots(
      { dates: [MON], services: [cut], staffId: "any" },
      data({ staff: [busyAna, eka] }),
    );
    const times = s.map((x) => x.start.getTime());
    expect(new Set(times).size).toBe(times.length);
    expect(s.find((x) => hhmm(x.start) === "15:00")?.staffId).toBe("eka"); // eka has less booked that day
    expect(s.find((x) => hhmm(x.start) === "10:00")?.staffId).toBe("eka"); // ana is busy then
  });

  it("12. a booking that would end after closing is not offered", () => {
    expect(starts(data(), [colour])).not.toContain("17:45");
    expect(starts(data(), [colour]).at(-1)).toBe("17:30");
  });

  it("13. timezone: 23:30 local is on the right local day", () => {
    const late = data({
      openingHours: { 1: [{ start: "20:00", end: "23:59" }] },
      staff: [staff("ana", { week: { 1: [{ start: "20:00", end: "23:59" }] } })],
    });
    const s = getAvailableSlots(
      { dates: [MON], services: [{ ...cut, durationMin: 15 }], staffId: "ana" },
      late,
    );
    const last = s.at(-1)!.start;
    expect(hhmm(last)).toBe("23:30");
    expect(last.toISOString()).toBe("2031-03-03T19:30:00.000Z"); // still Monday in Tbilisi
  });

  it("closed days (holidays) have no slots", () => {
    expect(starts(data({ closures: [MON] }))).toEqual([]);
  });
});

describe("validateBooking", () => {
  it("15. rescheduling: the loader leaves the booking itself out of busy, so its own time is free", () => {
    const own: [number, number] = [at(MON, "12:00"), at(MON, "13:00")];
    const others = data({ staff: [staff("ana", { busy: [] })] });
    expect(
      validateBooking({ staffId: "ana", start: new Date(own[0] + 30 * 60_000), services: [cut] }, others),
    ).toEqual([]);
    const withSelf = data({ staff: [staff("ana", { busy: [own] })] });
    expect(
      validateBooking({ staffId: "ana", start: new Date(own[0] + 30 * 60_000), services: [cut] }, withSelf),
    ).toEqual(["overlap"]);
  });

  it("explains outside hours, closed days and services the person does not do", () => {
    expect(
      validateBooking({ staffId: "ana", start: new Date(at(MON, "18:30")), services: [cut] }, data()),
    ).toEqual(["outsideHours"]);
    expect(
      validateBooking(
        { staffId: "ana", start: new Date(at(MON, "12:00")), services: [cut] },
        data({ closures: [MON] }),
      ),
    ).toEqual(["closed"]);
    const noColour = data({ staff: [staff("ana", { services: { cut: { durationMin: null } } })] });
    expect(
      validateBooking({ staffId: "ana", start: new Date(at(MON, "12:00")), services: [colour] }, noColour),
    ).toEqual(["cannotPerform"]);
  });
});

// Branches (decision 032): a person can work in several branches on different
// days; each interval says where. The booking is for one branch.
describe("branches", () => {
  const split = staff("ana", {
    week: {
      ...WEEK,
      1: [
        { start: "10:00", end: "14:00", locationId: "vake" },
        { start: "15:00", end: "19:00", locationId: "saburtalo" },
      ],
      2: [{ start: "10:00", end: "19:00", locationId: "saburtalo" }],
    },
  });

  it("only the intervals at the chosen branch give times", () => {
    const vake = starts(data({ staff: [split], locationId: "vake" }));
    expect(vake[0]).toBe("10:00");
    expect(vake.at(-1)).toBe("13:00");
    const sab = starts(data({ staff: [split], locationId: "saburtalo" }));
    expect(sab[0]).toBe("15:00");
    expect(sab.at(-1)).toBe("18:00");
  });

  it("a day spent in another branch gives no times here", () => {
    expect(starts(data({ staff: [split], locationId: "vake" }), [cut], "ana", "2031-03-04")).toEqual([]);
  });

  it("no branch given (one-branch business) = every interval counts", () => {
    expect(starts(data({ staff: [split] }))).toHaveLength(13 + 13);
  });

  it("a date change at another branch replaces the day everywhere", () => {
    const moved = staff("ana", {
      week: { ...WEEK, 1: [{ start: "10:00", end: "19:00", locationId: "vake" }] },
      overrides: { [MON]: { intervals: [{ start: "12:00", end: "16:00", locationId: "saburtalo" }] } },
    });
    expect(starts(data({ staff: [moved], locationId: "vake" }))).toEqual([]);
    const sab = starts(data({ staff: [moved], locationId: "saburtalo" }));
    expect([sab[0], sab.at(-1)]).toEqual(["12:00", "15:00"]);
  });

  it("a booking at another branch still blocks the person", () => {
    const busy = staff("ana", {
      week: { ...WEEK, 1: [{ start: "10:00", end: "19:00", locationId: "vake" }] },
      busy: [[at(MON, "10:00"), at(MON, "18:00")]],
    });
    expect(starts(data({ staff: [busy], locationId: "vake" }))).toEqual(["18:00"]);
  });

  it("a service switched off at the branch is not offered and not accepted", () => {
    const d = data({ staff: [split], locationId: "vake", notOffered: ["cut"] });
    expect(starts(d)).toEqual([]);
    expect(starts(d, [colour])).not.toEqual([]);
    expect(
      validateBooking({ staffId: "ana", start: new Date(at(MON, "10:00")), services: [cut] }, d),
    ).toEqual(["cannotPerform"]);
  });

  it("booking outside the person's hours at this branch is flagged", () => {
    const d = data({ staff: [split], locationId: "vake" });
    expect(
      validateBooking({ staffId: "ana", start: new Date(at(MON, "15:00")), services: [cut] }, d),
    ).toEqual(["outsideHours"]);
  });
});
