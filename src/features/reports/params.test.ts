import { describe, expect, it } from "vitest";
import { changePct, comparisonRange, reportParams } from "./params";

describe("report params", () => {
  it("defaults: this month, no comparison, overview", () => {
    expect(reportParams({}, "2026-11-07")).toEqual({
      from: "2026-11-01",
      to: "2026-11-07",
      staff: null,
      compare: "off",
      tab: "overview",
    });
  });

  it("unknown tab or comparison falls back", () => {
    const p = reportParams({ tab: "nope", compare: "x" }, "2026-11-07");
    expect([p.tab, p.compare]).toEqual(["overview", "off"]);
    expect(reportParams({ tab: "staff", compare: "year" }, "2026-11-07")).toMatchObject({
      tab: "staff",
      compare: "year",
    });
  });

  it("previous period: the same number of days right before", () => {
    expect(comparisonRange("2026-11-01", "2026-11-07", "previous")).toEqual({
      from: "2026-10-25",
      to: "2026-10-31",
    });
    expect(comparisonRange("2026-03-01", "2026-03-31", "previous")).toEqual({
      from: "2026-01-29",
      to: "2026-02-28",
    });
  });

  it("same period last year, 29 February becomes 28", () => {
    expect(comparisonRange("2028-02-01", "2028-02-29", "year")).toEqual({
      from: "2027-02-01",
      to: "2027-02-28",
    });
    expect(comparisonRange("2026-11-01", "2026-11-07", "off")).toBeNull();
  });

  it("change in %", () => {
    expect(changePct(120, 100)).toBe(20);
    expect(changePct(50, 200)).toBe(-75);
    expect(changePct(5, 0)).toBeNull();
    expect(changePct(null, 10)).toBeNull();
  });
});
