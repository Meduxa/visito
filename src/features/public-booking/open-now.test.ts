import { describe, expect, it } from "vitest";
import { openNow } from "./open-now";

// Monday–Friday 10:00–20:00, Saturday 11:00–15:00, Sunday closed
const hours = {
  1: [["10:00", "20:00"]],
  2: [["10:00", "20:00"]],
  3: [["10:00", "20:00"]],
  4: [["10:00", "20:00"]],
  5: [["10:00", "20:00"]],
  6: [["11:00", "15:00"]],
} as Record<number, [string, string][]>;

describe("openNow (Tbilisi, UTC+4)", () => {
  it("open during the day", () => {
    // Monday 2 Nov 2026, 12:00 in Tbilisi = 08:00 UTC
    expect(openNow(hours, "Asia/Tbilisi", new Date("2026-11-02T08:00:00Z"))).toEqual({
      open: true,
      today: [["10:00", "20:00"]],
    });
  });

  it("closed before opening and from closing time on", () => {
    expect(openNow(hours, "Asia/Tbilisi", new Date("2026-11-02T05:59:00Z")).open).toBe(false); // 09:59
    expect(openNow(hours, "Asia/Tbilisi", new Date("2026-11-02T16:00:00Z")).open).toBe(false); // 20:00
  });

  it("uses the business's day, not the visitor's", () => {
    // Sunday 1 Nov 2026 22:30 UTC = Monday 02:30 in Tbilisi
    expect(openNow(hours, "Asia/Tbilisi", new Date("2026-11-01T22:30:00Z")).today).toEqual([
      ["10:00", "20:00"],
    ]);
  });

  it("a closed day has no hours", () => {
    // Sunday 1 Nov 2026, 12:00 in Tbilisi
    expect(openNow(hours, "Asia/Tbilisi", new Date("2026-11-01T08:00:00Z"))).toEqual({
      open: false,
      today: [],
    });
  });
});
