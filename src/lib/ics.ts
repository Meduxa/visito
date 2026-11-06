// A one-event calendar file (.ics) for "add to calendar". Times in UTC.
const stamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const escape = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");

export function makeIcs(e: {
  uid: string;
  start: string;
  end: string;
  title: string;
  location?: string | null;
  description?: string;
}) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Visito//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.uid}@bookeria`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${escape(e.title)}`,
    ...(e.location ? [`LOCATION:${escape(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${escape(e.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
