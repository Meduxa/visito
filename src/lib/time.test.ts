import { describe, expect, it } from "vitest";
import { intervalProblem, outsideHours, utcToZoned, zonedToUtcIso } from "./time";

describe("intervalProblem", () => {
  it("accepts a split shift with a lunch break", () => {
    expect(
      intervalProblem([
        { start: "10:00", end: "14:00" },
        { start: "15:00", end: "20:00" },
      ]),
    ).toBeNull();
  });

  it("accepts back-to-back intervals", () => {
    expect(
      intervalProblem([
        { start: "10:00", end: "14:00" },
        { start: "14:00", end: "18:00" },
      ]),
    ).toBeNull();
  });

  it("finds overlaps regardless of order", () => {
    expect(
      intervalProblem([
        { start: "15:00", end: "20:00" },
        { start: "10:00", end: "15:30" },
      ]),
    ).toBe("overlap");
  });

  it("finds end before start and bad times", () => {
    expect(intervalProblem([{ start: "18:00", end: "10:00" }])).toBe("endBeforeStart");
    expect(intervalProblem([{ start: "25:00", end: "26:00" }])).toBe("badTime");
  });
});

describe("Tbilisi time", () => {
  it("converts local time to UTC (UTC+4, no daylight saving)", () => {
    expect(zonedToUtcIso("2027-02-01", "10:00")).toBe("2027-02-01T06:00:00.000Z");
    expect(zonedToUtcIso("2027-07-01", "10:00")).toBe("2027-07-01T06:00:00.000Z");
  });

  it("a time late in the evening stays on the same local day", () => {
    expect(utcToZoned("2027-02-01T19:30:00Z")).toEqual({ date: "2027-02-01", time: "23:30" });
    expect(utcToZoned("2027-02-01T20:30:00Z")).toEqual({ date: "2027-02-02", time: "00:30" });
  });
});

describe("outsideHours", () => {
  const open = [{ start: "11:00", end: "19:00" }];
  it("fits inside opening hours", () => {
    expect(outsideHours({ start: "11:00", end: "19:00" }, open)).toBe(false);
    expect(outsideHours({ start: "12:00", end: "15:00" }, open)).toBe(false);
  });
  it("starts before opening or ends after closing", () => {
    expect(outsideHours({ start: "10:00", end: "18:00" }, open)).toBe(true);
    expect(outsideHours({ start: "12:00", end: "20:00" }, open)).toBe(true);
  });
  it("closed day", () => {
    expect(outsideHours({ start: "12:00", end: "13:00" }, [])).toBe(true);
  });
});
