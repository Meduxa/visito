import { describe, expect, it } from "vitest";
import { computeReport, type RBooking, type ReportInput } from "./compute";

const item = (staffId: string, price: number, minutes = 60, service = "cut") => ({
  staffId,
  serviceKey: service,
  serviceName: service,
  categoryId: "hair",
  priceMinor: price,
  minutes,
});
const booking = (
  id: string,
  status: string,
  client: string | null,
  date: string,
  items = [item("ana", 5000)],
  source = "admin",
): RBooking => ({
  id,
  status,
  source,
  clientId: client,
  date,
  items,
});

const base: ReportInput = {
  from: "2026-10-01",
  to: "2026-10-31",
  today: "2026-12-31",
  categories: { hair: "Hair" },
  staff: [
    { id: "ana", name: "Ana", commissionPct: 40, workingMinutes: 600 },
    { id: "eka", name: "Eka", commissionPct: 0, workingMinutes: 600 },
  ],
  bookings: [],
  payments: [],
  clientVisits: {},
};

describe("computeReport", () => {
  it("money: received by day and method, tips apart, average ticket per paid visit", () => {
    const r = computeReport({
      ...base,
      payments: [
        { date: "2026-10-02", method: "cash", amountMinor: 3000, tipMinor: 500, bookingId: "b1" },
        { date: "2026-10-02", method: "card", amountMinor: 2000, tipMinor: 0, bookingId: "b1" },
        { date: "2026-10-05", method: "card", amountMinor: 4000, tipMinor: 0, bookingId: "b2" },
      ],
    });
    expect(r.money.receivedMinor).toBe(9000);
    expect(r.money.tipsMinor).toBe(500);
    expect(r.money.averageTicketMinor).toBe(4500); // 2 paid visits
    expect(r.money.byDay).toEqual([
      { date: "2026-10-02", minor: 5000 },
      { date: "2026-10-05", minor: 4000 },
    ]);
    expect(r.money.byMethod[0]).toEqual({ method: "card", minor: 6000, tipsMinor: 0 });
    expect(r.money.byMethod[1]).toEqual({ method: "cash", minor: 3000, tipsMinor: 500 });
    // a month is charted by day, every day present
    expect(r.bucket).toBe("day");
    expect(r.series).toHaveLength(31);
    expect(r.series[1]).toEqual({
      key: "2026-10-02",
      receivedMinor: 5000,
      bookings: 0,
      byMethod: { cash: 3000, card: 2000 },
    });
  });

  it("rates, sources, service value and commission from completed visits only", () => {
    const r = computeReport({
      ...base,
      bookings: [
        booking("1", "completed", "c1", "2026-10-02"),
        booking("2", "completed", "c2", "2026-10-03", [item("eka", 3000, 30, "nails")], "online"),
        booking("3", "no_show", "c3", "2026-10-04"),
        booking("4", "cancelled_by_client", "c4", "2026-10-05"),
        booking("5", "confirmed", "c5", "2026-10-30"),
      ],
    });
    expect(r.bookings.noShowRatePct).toBe(33.3); // 1 of (2 completed + 1 no-show)
    expect(r.bookings.cancellationRatePct).toBe(20); // 1 of 5
    expect(r.bookings.bySource).toEqual({ admin: 4, online: 1 });
    const ana = r.staff.find((s) => s.id === "ana")!;
    expect(ana).toMatchObject({ valueMinor: 5000, commissionMinor: 2000 });
    // booked minutes count everything but cancellations and no-shows: Ana 1 + 1 (confirmed) hour
    expect(ana.bookedMinutes).toBe(120);
    expect(ana.occupancyPct).toBe(20);
    expect(r.occupancyPct).toBe(12.5); // (120 + 30) / 1200
    expect(r.topServices[0]).toMatchObject({ name: "cut", count: 1 });
    // bookings over time: cancelled ones do not count
    expect(r.series.find((x) => x.key === "2026-10-05")!.bookings).toBe(0);
    expect(r.series.find((x) => x.key === "2026-10-04")!.bookings).toBe(1);
    expect(r.money.byCategory).toEqual([{ name: "Hair", minor: 8000, count: 2 }]);
  });

  it("longer periods are charted by month", () => {
    const r = computeReport({
      ...base,
      from: "2026-01-15",
      to: "2026-11-07",
      bookings: [
        booking("1", "completed", "c1", "2026-03-02"),
        booking("2", "confirmed", "c2", "2026-03-30"),
      ],
      payments: [{ date: "2026-11-01", method: "card", amountMinor: 700, tipMinor: 0, bookingId: "1" }],
    });
    expect(r.bucket).toBe("month");
    expect(r.series.map((x) => x.key)).toEqual(
      ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11"].map((m) => `2026-${m}`),
    );
    expect(r.series[2].bookings).toBe(2);
    expect(r.series[10].receivedMinor).toBe(700);
  });

  it("new vs returning clients and retention windows that had time to pass", () => {
    const r = computeReport({
      ...base,
      today: "2026-11-20", // 50 days after 1 Oct: only the 30-day window is complete for early clients
      bookings: [
        booking("1", "completed", "new1", "2026-10-01"),
        booking("2", "completed", "new2", "2026-10-02"),
        booking("3", "completed", "old", "2026-10-03"),
        booking("4", "completed", "late", "2026-10-30"), // only 21 days ago: in no window yet
      ],
      clientVisits: {
        new1: ["2026-10-01", "2026-10-20"], // back after 19 days
        new2: ["2026-10-02"],
        old: ["2026-05-01", "2026-10-03"],
        late: ["2026-10-30"],
      },
    });
    expect(r.clients).toMatchObject({ seen: 4, new: 3, returning: 1 });
    expect(r.clients.retentionPct.d30).toBe(50); // new1 yes, new2 no
    expect(r.clients.retentionPct.d60).toBeNull(); // nobody has had 60 days yet
  });
});
