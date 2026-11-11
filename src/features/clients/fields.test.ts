import { describe, expect, it } from "vitest";
import {
  cleanCustom,
  clientFieldSchema,
  parseColumns,
  segmentRulesSchema,
  visibleColumns,
  type ClientField,
} from "./fields";

const fields: ClientField[] = [
  { id: "a", label: "Hair", kind: "choice", options: ["dry", "oily"] },
  { id: "b", label: "Formula", kind: "text", options: [] },
  { id: "c", label: "Size", kind: "number", options: [] },
  { id: "d", label: "Patch test", kind: "date", options: [] },
  { id: "e", label: "Allergy", kind: "yesno", options: [] },
];

describe("own client fields", () => {
  it("keeps only known fields, in the right type", () => {
    expect(
      cleanCustom(
        { a: "dry", b: "  6/0 + 3%  ", c: "37,5", d: "2026-11-01", e: false, gone: "x", z: 1 },
        fields,
      ),
    ).toEqual({ a: "dry", b: "6/0 + 3%", c: 37.5, d: "2026-11-01", e: false });
  });

  it("drops empty and wrong values", () => {
    expect(cleanCustom({ a: "curly", b: "", c: "abc", d: "11/01/2026", e: "yes" }, fields)).toEqual({});
    expect(cleanCustom(null, fields)).toEqual({});
    expect(cleanCustom({ b: "x".repeat(900) }, fields).b).toHaveLength(500);
  });

  it("a choice field needs options; others don't keep any", () => {
    expect(clientFieldSchema.safeParse({ label: "Hair", kind: "choice", options: [] }).success).toBe(false);
    const ok = clientFieldSchema.parse({ label: " Hair ", kind: "choice", options: ["dry", "dry", "oily"] });
    expect(ok).toEqual({ label: "Hair", kind: "choice", options: ["dry", "oily"] });
    expect(clientFieldSchema.parse({ label: "N", kind: "text", options: ["x"] }).options).toEqual([]);
  });
});

describe("list columns", () => {
  it("reads the cookie, drops unknown or removed columns", () => {
    expect(parseColumns(undefined, fields)).toBeNull();
    expect(parseColumns("phone,f:a,f:zzz,hack,phone,spent", fields)).toEqual(["phone", "f:a", "spent"]);
    expect(parseColumns("", fields)).toEqual([]);
  });

  it("money columns only for people who may see money", () => {
    expect(visibleColumns(null, true)).toContain("spent");
    expect(visibleColumns(null, false)).not.toContain("spent");
    expect(visibleColumns(["average", "f:a"], false)).toEqual(["f:a"]);
  });
});

describe("group thresholds", () => {
  it("'lost' must come after 'at risk'", () => {
    expect(segmentRulesSchema.safeParse({ vipVisits: 5, atRiskDays: 90, lostDays: 60 }).success).toBe(false);
    expect(segmentRulesSchema.parse({ vipVisits: "4", atRiskDays: "45", lostDays: "120" })).toEqual({
      vipVisits: 4,
      atRiskDays: 45,
      lostDays: 120,
    });
    expect(segmentRulesSchema.safeParse({ vipVisits: 1, atRiskDays: 60, lostDays: 180 }).success).toBe(false);
  });
});
