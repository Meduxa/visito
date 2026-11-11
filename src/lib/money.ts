// Money is integer tetri (1 GEL = 100 tetri). Never floats in storage.

export function formatMoney(minor: number, locale = "ka-GE", currency = "GEL"): string {
  if (!Number.isInteger(minor)) throw new Error("Money must be an integer number of minor units");
  // Whole amounts without ",00" (price lists say 55 ₾, not 55,00 ₾).
  const digits = minor % 100 === 0 ? 0 : 2;
  // Written out by hand rather than with Intl: browsers without Georgian locale
  // data print "55.50" (and "GEL 55") where the server prints "55,50" — the same
  // amount must read the same on the server and in every browser. Same rules as
  // Intl ka-GE / ru-RU (no-break space between thousands, decimal comma) and en.
  const [group, decimal] = locale.startsWith("en") ? [",", "."] : [" ", ","];
  const [int, frac] = (Math.abs(minor) / 100).toFixed(digits).split(".");
  const number =
    (minor < 0 ? "-" : "") + int.replace(/\B(?=(\d{3})+(?!\d))/g, group) + (frac ? decimal + frac : "");
  return currency === "GEL" ? `${number} ₾` : `${number} ${currency}`;
}

// "55", "55.5", "55,50" → 5550. Returns null for anything else.
export function parseMoneyToMinor(input: string): number | null {
  const m = input
    .trim()
    .replace(/\s/g, "")
    .match(/^(\d+)(?:[.,](\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}
