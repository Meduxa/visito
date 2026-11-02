// "Open now · today 10:00–20:00" on a business's website. Hours are local times by
// ISO weekday (1 = Monday) in the business's time zone.

export type OpenNow = { open: boolean; today: [string, string][] };

export function openNow(hours: Record<number, [string, string][]>, timeZone: string, now: Date): OpenNow {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  const time = `${get("hour")}:${get("minute")}`;
  const today = hours[weekday] ?? [];
  return { open: today.some(([s, e]) => time >= s && time < e), today };
}
