import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToMinor } from "./money";

describe("money", () => {
  it("parses prices to tetri", () => {
    expect(parseMoneyToMinor("55")).toBe(5500);
    expect(parseMoneyToMinor("55.5")).toBe(5550);
    expect(parseMoneyToMinor("55,05")).toBe(5505);
    expect(parseMoneyToMinor("1 200")).toBe(120000);
  });

  it("rejects invalid input", () => {
    for (const bad of ["", "-5", "5.555", "abc", "5.", "1e3"]) expect(parseMoneyToMinor(bad)).toBeNull();
  });

  it("formats GEL as people write it, whatever the browser's locale data", () => {
    expect(formatMoney(5500)).toBe("55 ₾");
    expect(formatMoney(5550)).toBe("55,50 ₾");
    expect(formatMoney(5500, "en-US")).toBe("55 ₾");
    expect(formatMoney(5550, "en-US")).toBe("55.50 ₾");
    // the same as Intl ka-GE on a full-ICU server, but without needing the browser's locale data
    expect(formatMoney(1234550)).toBe(
      `${new Intl.NumberFormat("ka-GE", { minimumFractionDigits: 2 }).format(12345.5)} ₾`,
    );
    expect(formatMoney(1234500)).toBe("12 345 ₾");
    expect(formatMoney(123456700, "en")).toBe("1,234,567 ₾");
    expect(formatMoney(-5550)).toBe("-55,50 ₾");
  });

  it("refuses fractional tetri", () => {
    expect(() => formatMoney(10.5)).toThrow();
  });
});
