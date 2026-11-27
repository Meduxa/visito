import "server-only";
import writeXlsxFile from "write-excel-file/node";
import { excelSafe } from "@/lib/excel-safe";

// "Download everything (Excel)" for a salon owner, not a database dump (test
// plan #64): sheet and column names in the owner's language, names instead of
// IDs, money in lari, dates and times in the business's time zone. The JSON
// file stays the complete technical copy.

type Cell = {
  value: string | number | null;
  fontWeight?: "bold";
  format?: string;
  type?: NumberConstructor | StringConstructor;
} | null;
type Row = Record<string, unknown>;
export type Translator = ((key: string, values?: Record<string, string | number>) => string) & {
  has: (key: string) => boolean;
};

const head = (labels: string[]): Cell[] => labels.map((value) => ({ value, fontWeight: "bold" }));
const text = (v: unknown): Cell =>
  v === null || v === undefined || v === "" ? null : { value: excelSafe(String(v)), type: String };
// stored phone numbers are validated E.164 ("+995…"), never a formula: no apostrophe
const phone = (v: unknown): Cell =>
  typeof v === "string" && /^\+\d{6,15}$/.test(v) ? { value: v, type: String } : text(v);
const num = (v: unknown): Cell => (typeof v === "number" ? { value: v, type: Number } : null);
const gel = (minor: unknown): Cell =>
  typeof minor === "number" ? { value: minor / 100, type: Number, format: "#,##0.00" } : null;

const list = (d: Row, key: string) => (Array.isArray(d[key]) ? (d[key] as Row[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

export async function businessWorkbook(d: Row, opts: { t: Translator; locale: string; timeZone: string }) {
  const { t, locale, timeZone } = opts;
  const C = (k: string) => t(`businessExport.cols.${k}`);
  const word = (key: string, raw: unknown) => {
    const v = str(raw);
    return v && t.has(`${key}.${v}`) ? t(`${key}.${v}`) : v;
  };
  const yes = (v: unknown) =>
    v === true ? t("businessExport.yes") : v === false ? t("businessExport.no") : "";
  const day = (iso: unknown) =>
    str(iso) ? new Date(str(iso)).toLocaleDateString("en-CA", { timeZone }) : "";
  const time = (iso: unknown) =>
    str(iso)
      ? new Date(str(iso)).toLocaleTimeString("en-GB", { timeZone, hour: "2-digit", minute: "2-digit" })
      : "";
  const hhmm = (v: unknown) => str(v).slice(0, 5);
  const i18n = (v: unknown) => {
    const o = (v ?? {}) as Record<string, string>;
    return o[locale] || o.ka || o.en || o.ru || "";
  };
  const names = (rows: Row[], name: (r: Row) => string) =>
    new Map(rows.map((r) => [str(r.id), name(r)] as const));

  const clients = list(d, "clients");
  const staff = list(d, "staff");
  const locations = list(d, "locations");
  const services = list(d, "services");
  const categories = list(d, "service_categories");
  const bookings = list(d, "bookings");
  const clientName = names(clients, (c) =>
    c.anonymized_at ? t("businessExport.deletedClient") : `${str(c.first_name)} ${str(c.last_name)}`.trim(),
  );
  const clientPhone = names(clients, (c) => str(c.phone_e164));
  const staffName = names(staff, (s) => str(s.display_name));
  const locName = names(locations, (l) => str(l.name));
  const serviceName = names(services, (s) => i18n(s.name_i18n));
  const categoryName = names(categories, (c) => i18n(c.name_i18n));
  const bookingStart = names(bookings, (b) => str(b.starts_at));
  const of = (m: Map<string, string>, id: unknown) => m.get(str(id)) ?? "";
  const weekday = (n: unknown) => (typeof n === "number" ? t(`weekdays.long.${n}`) : "");

  const sheets: { name: string; rows: Cell[][] }[] = [];
  const sheet = (key: string, cols: string[], rows: Cell[][]) =>
    sheets.push({ name: t(`businessExport.sheets.${key}`).slice(0, 31), rows: [head(cols.map(C)), ...rows] });

  // clients, with the business's own client fields as extra columns
  const fields = list(d, "client_fields");
  sheets.push({
    name: t("businessExport.sheets.clients").slice(0, 31),
    rows: [
      head([
        ...["firstName", "lastName", "phone", "email", "birthday", "importantNote", "notes", "tags"].map(C),
        ...fields.map((f) => str(f.label)),
        C("noShows"),
        C("added"),
        C("dataDeleted"),
      ]),
      ...clients.map((c) => {
        const custom = (c.custom ?? {}) as Record<string, unknown>;
        return [
          text(c.first_name),
          text(c.last_name),
          phone(c.phone_e164),
          text(c.email),
          text(c.birthday),
          text(c.important_note),
          text(c.notes),
          text(Array.isArray(c.tags) ? c.tags.join(", ") : ""),
          ...fields.map((f) => {
            const v = custom[str(f.id)];
            return typeof v === "boolean" ? text(yes(v)) : text(Array.isArray(v) ? v.join(", ") : v);
          }),
          num(c.no_show_count),
          text(day(c.created_at)),
          text(day(c.anonymized_at)),
        ];
      }),
    ],
  });

  sheet(
    "visits",
    [
      "date",
      "time",
      "branch",
      "client",
      "phone",
      "services",
      "specialist",
      "status",
      "source",
      "price",
      "discount",
      "paid",
      "clientComment",
      "internalNote",
      "cancelReason",
    ],
    bookings.map((b) => {
      const items = Array.isArray(b.items) ? (b.items as Row[]) : [];
      const charges = Array.isArray(b.charges) ? (b.charges as Row[]) : [];
      return [
        text(day(b.starts_at)),
        text(`${time(b.starts_at)}–${time(b.ends_at)}`),
        text(of(locName, b.location_id)),
        text(of(clientName, b.client_id)),
        phone(of(clientPhone, b.client_id)),
        text([...items.map((i) => str(i.name_snapshot)), ...charges.map((c) => str(c.name))].join(", ")),
        text([...new Set(items.map((i) => of(staffName, i.staff_id)))].join(", ")),
        text(word("booking.status", b.status)),
        text(word("booking.sources", b.source)),
        gel(b.total_minor),
        gel(b.discount_minor),
        gel(b.paid_minor),
        text(b.client_comment),
        text(b.internal_note),
        text(b.cancel_reason),
      ];
    }),
  );

  sheet(
    "payments",
    ["date", "client", "visitDate", "amount", "tip", "tipFor", "method", "status"],
    list(d, "payments").map((p) => {
      const booking = bookings.find((b) => b.id === p.booking_id);
      return [
        text(day(p.created_at)),
        text(of(clientName, booking?.client_id)),
        text(day(of(bookingStart, p.booking_id))),
        gel(p.amount_minor),
        gel(p.tip_minor),
        text(of(staffName, p.tip_staff_id)),
        text(word("checkout.methods", p.method)),
        text(word("businessExport.paymentStatus", p.status)),
      ];
    }),
  );

  sheet(
    "services",
    ["category", "name", "nameEn", "nameRu", "duration", "price", "priceMax", "online", "active"],
    services.map((s) => {
      const n = (s.name_i18n ?? {}) as Record<string, string>;
      return [
        text(of(categoryName, s.category_id)),
        text(n.ka),
        text(n.en),
        text(n.ru),
        num(s.duration_min),
        gel(s.price_minor),
        gel(s.price_max_minor),
        text(yes(s.bookable_online)),
        text(yes(s.active)),
      ];
    }),
  );

  const salary = new Map(list(d, "staff_pay").map((p) => [str(p.staff_id), p.salary_minor] as const));
  sheet(
    "staff",
    ["name", "position", "branch", "phone", "email", "online", "active", "commission", "salary"],
    staff.map((s) => [
      text(s.display_name),
      text(s.position),
      text(of(locName, s.location_id)),
      phone(s.phone),
      text(s.email),
      text(yes(s.bookable_online)),
      text(yes(s.active)),
      num(s.commission_pct),
      gel(salary.get(str(s.id))),
    ]),
  );

  sheet(
    "schedules",
    ["specialist", "branch", "weekday", "from", "to"],
    list(d, "staff_schedules").map((s) => [
      text(of(staffName, s.staff_id)),
      text(of(locName, s.location_id)),
      text(weekday(s.weekday)),
      text(hhmm(s.start_time)),
      text(hhmm(s.end_time)),
    ]),
  );

  sheet(
    "timeOff",
    ["specialist", "from", "to", "reason", "note"],
    list(d, "time_off").map((o) => [
      text(of(staffName, o.staff_id)),
      text(`${day(o.starts_at)} ${time(o.starts_at)}`),
      text(`${day(o.ends_at)} ${time(o.ends_at)}`),
      text(word("staff.reasons", o.reason)),
      text(o.note),
    ]),
  );

  const hours = list(d, "location_hours");
  sheet(
    "branches",
    ["name", "address", "phone", "active", "hours"],
    locations.map((l) => [
      text(l.name),
      text(l.address),
      phone(l.phone),
      text(yes(l.active)),
      text(
        hours
          .filter((h) => h.location_id === l.id)
          .map((h) => `${t(`weekdays.short.${h.weekday}`)} ${hhmm(h.start_time)}–${hhmm(h.end_time)}`)
          .join(", "),
      ),
    ]),
  );

  sheet(
    "closures",
    ["date", "branch", "reason"],
    list(d, "closures").map((c) => [
      text(c.date),
      text(c.location_id ? of(locName, c.location_id) : t("businessExport.allBranches")),
      text(c.reason),
    ]),
  );

  sheet(
    "reviews",
    ["date", "client", "specialist", "rating", "comment", "reply", "visible"],
    list(d, "reviews").map((r) => [
      text(day(r.created_at)),
      text(of(clientName, r.client_id)),
      text(of(staffName, r.staff_id)),
      num(r.rating),
      text(r.comment),
      text(r.reply),
      text(yes(r.status === "published")),
    ]),
  );

  sheet(
    "waitlist",
    ["added", "client", "service", "specialist", "from", "to", "note", "status"],
    list(d, "waitlist").map((w) => [
      text(day(w.created_at)),
      text(of(clientName, w.client_id)),
      text(of(serviceName, w.service_id)),
      text(of(staffName, w.staff_id)),
      text(`${str(w.date_from)} ${hhmm(w.time_from)}`.trim()),
      text(`${str(w.date_to)} ${hhmm(w.time_to)}`.trim()),
      text(w.note),
      text(w.status),
    ]),
  );

  sheet(
    "payroll",
    ["month", "specialist", "kind", "amount", "method", "paidOn", "note"],
    [
      ...list(d, "pay_adjustments").map((a) => [
        text(a.month),
        text(of(staffName, a.staff_id)),
        text(word("payroll", a.kind)),
        gel(a.amount_minor),
        null,
        null,
        text(a.note),
      ]),
      ...list(d, "payouts").map((p) => [
        text(p.month),
        text(of(staffName, p.staff_id)),
        text(t("businessExport.payout")),
        gel(p.amount_minor),
        text(word("payroll.methods", p.method)),
        text(p.paid_on),
        text(p.note),
      ]),
    ],
  );

  sheet(
    "sms",
    ["date", "phone", "client", "type", "status", "segments"],
    list(d, "sms_messages").map((m) => [
      text(`${day(m.created_at)} ${time(m.created_at)}`),
      phone(m.to_phone),
      text(of(clientName, m.client_id)),
      text(word("smsLog.types", m.type)),
      text(word("smsLog.status", m.status)),
      num(m.segments),
    ]),
  );

  sheet(
    "consents",
    ["date", "client", "purpose", "channel", "granted", "source"],
    list(d, "consents").map((c) => [
      text(`${day(c.at)} ${time(c.at)}`),
      text(of(clientName, c.client_id)),
      text(c.purpose),
      text(c.channel),
      text(yes(c.granted)),
      text(c.source),
    ]),
  );

  return (await writeXlsxFile(
    sheets.map((s) => s.rows),
    { sheets: sheets.map((s) => s.name), buffer: true } as never,
  )) as unknown as Buffer;
}
