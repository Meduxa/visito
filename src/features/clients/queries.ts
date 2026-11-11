import "server-only";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { formatInTimeZone } from "date-fns-tz";
import {
  DEFAULT_RULES,
  type ClientField,
  type CustomValues,
  type FieldKind,
  type SegmentRules,
} from "./fields";
import { PAGE_SIZE, segments, type ClientListParams, type Segment } from "./schema";

export type ClientRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  gender: "female" | "male" | "other" | null;
  source: string | null;
  tags: string[];
  notes: string | null;
  importantNote: string | null;
  preferredStaffId: string | null;
  blockedOnline: boolean;
  noShowCount: number;
  anonymized: boolean;
  createdAt: string;
  consentSms: boolean;
  consentEmail: boolean;
  // visit numbers from the client_list view (decision 024)
  visits: number;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  cancellations: number;
  spentMinor: number | null; // null: this person may not see money
  averageMinor: number | null;
  segment: Segment;
  since: string; // the earlier of "added" and the first booking (imported history)
  custom: CustomValues; // own fields (decision 026)
};

type Db = Awaited<ReturnType<typeof createClient>>;

// Search, group, filters — shared by the list and the group counts.
function filtered(
  supabase: Db,
  tenantId: string,
  p: ClientListParams,
  opts: { birthdayMonth: number; count?: "head" },
) {
  let query = supabase
    .from("client_list")
    .select("*", opts.count ? { count: "exact", head: true } : { count: "exact" })
    .eq("tenant_id", tenantId)
    .is("anonymized_at", null);
  const term = p.q
    .trim()
    .replace(/[%,()*\\]/g, " ")
    .trim();
  if (term) {
    const digits = term.replace(/\D/g, "");
    const parts = [`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`, `email.ilike.%${term}%`];
    if (digits.length >= 3) parts.push(`phone_e164.like.%${digits}%`);
    query = query.or(parts.join(","));
  }
  if (p.tag) query = query.contains("tags", [p.tag]);
  if (p.upcoming) query = query.not("next_visit_at", "is", null);
  if (p.birthday) query = query.eq("birthday_month", opts.birthdayMonth);
  if (p.noshow) query = query.gt("no_show_count", 0);
  return query;
}

function sorted<Q extends ReturnType<typeof filtered>>(query: Q, sort: ClientListParams["sort"]): Q {
  return (
    sort === "name"
      ? query.order("first_name").order("last_name", { nullsFirst: true })
      : sort === "last_visit"
        ? query.order("last_visit_at", { ascending: false, nullsFirst: false })
        : sort === "visits"
          ? query.order("visits", { ascending: false })
          : sort === "spent"
            ? query.order("spent_minor", { ascending: false, nullsFirst: false })
            : query.order("created_at", { ascending: false })
  ) as Q;
}

// The list: search by name, phone or email; group and filters; sorting; 50 a
// page. tenantId is server-resolved; RLS also limits what staff can see.
export async function listClients(tenantId: string, p: ClientListParams, opts: { timeZone: string }) {
  const supabase = await createClient();
  const birthdayMonth = Number(formatInTimeZone(new Date(), opts.timeZone, "M"));
  let query = filtered(supabase, tenantId, p, { birthdayMonth });
  if (p.segment) query = query.eq("segment", p.segment);
  query = sorted(query, p.sort)
    .order("id") // imports insert many clients at the same instant: keep pages stable
    .range(p.page * PAGE_SIZE, p.page * PAGE_SIZE + PAGE_SIZE - 1);

  // how many clients each group has, with the same search and filters
  const [{ data, error, count }, ...groupCounts] = await Promise.all([
    query,
    ...segments.map((s) =>
      filtered(supabase, tenantId, p, { birthdayMonth, count: "head" }).eq("segment", s),
    ),
  ]);
  if (error) throw new Error("Could not load clients");
  const segmentCounts = Object.fromEntries(segments.map((s, i) => [s, groupCounts[i].count ?? 0])) as Record<
    Segment,
    number
  >;

  const granted = await consentFor(
    supabase,
    data.map((c) => c.id!),
  );

  return {
    total: count ?? 0,
    segmentCounts,
    clients: data.map((c) => toRow(c, granted)),
  };
}

type ListRow = Database["public"]["Views"]["client_list"]["Row"];

function toRow(c: ListRow, granted: Set<string>): ClientRow {
  return {
    id: c.id!,
    firstName: c.first_name ?? "",
    lastName: c.last_name,
    phone: c.phone_e164,
    email: c.email,
    birthday: c.birthday,
    gender: c.gender as ClientRow["gender"],
    source: c.source,
    tags: c.tags ?? [],
    notes: c.notes,
    importantNote: c.important_note,
    preferredStaffId: c.preferred_staff_id,
    blockedOnline: c.blocked_online ?? false,
    noShowCount: c.no_show_count ?? 0,
    anonymized: !!c.anonymized_at,
    createdAt: c.created_at!,
    consentSms: granted.has(`${c.id}:sms`),
    consentEmail: granted.has(`${c.id}:email`),
    visits: c.visits ?? 0,
    lastVisitAt: c.last_visit_at,
    nextVisitAt: c.next_visit_at,
    cancellations: c.cancellations ?? 0,
    spentMinor: c.spent_minor,
    averageMinor: c.average_minor,
    segment: (c.segment ?? "new") as Segment,
    since: c.first_booking_at && c.first_booking_at < c.created_at! ? c.first_booking_at : c.created_at!,
    custom: (c.custom ?? {}) as CustomValues,
  };
}

async function consentFor(supabase: Db, ids: string[]) {
  const granted = new Set<string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabase
      .from("client_consent_state")
      .select("client_id, channel, granted")
      .in("client_id", ids.slice(i, i + 300));
    for (const c of data ?? []) if (c.granted) granted.add(`${c.client_id}:${c.channel}`);
  }
  return granted;
}

/** Every client of the current view (search, group, filters, sorting), for the Excel download. */
export async function listClientsForExport(
  tenantId: string,
  p: ClientListParams,
  opts: { timeZone: string; max?: number },
) {
  const supabase = await createClient();
  const birthdayMonth = Number(formatInTimeZone(new Date(), opts.timeZone, "M"));
  const max = opts.max ?? 10_000;
  const rows: ListRow[] = [];
  for (let from = 0; from < max; from += 1000) {
    let query = filtered(supabase, tenantId, p, { birthdayMonth });
    if (p.segment) query = query.eq("segment", p.segment);
    const { data, error } = await sorted(query, p.sort)
      .order("id")
      .range(from, Math.min(from + 999, max - 1));
    if (error) throw new Error("Could not load clients");
    rows.push(...data);
    if (data.length < 1000) break;
  }
  const granted = await consentFor(
    supabase,
    rows.map((r) => r.id!),
  );
  return rows.map((c) => toRow(c, granted));
}

/** The business's own client fields, in order. */
export async function listClientFields(tenantId: string): Promise<ClientField[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_fields")
    .select("id, label, kind, options")
    .eq("tenant_id", tenantId)
    .order("sort_order")
    .order("created_at");
  return (data ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    kind: f.kind as FieldKind,
    options: f.options,
  }));
}

export async function getSegmentRules(tenantId: string): Promise<SegmentRules> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tenant_settings")
    .select("segment_vip_visits, segment_at_risk_days, segment_lost_days")
    .eq("tenant_id", tenantId)
    .single();
  return data
    ? {
        vipVisits: data.segment_vip_visits,
        atRiskDays: data.segment_at_risk_days,
        lostDays: data.segment_lost_days,
      }
    : DEFAULT_RULES;
}

export async function getConsentHistory(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_consents")
    .select("id, channel, granted, source, at")
    .eq("client_id", clientId)
    .order("at", { ascending: false })
    .limit(50);
  return data ?? [];
}

/** Every tag in use, for the tag filter and SMS by tag. */
export async function listClientTags(tenantId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clients")
    .select("tags")
    .eq("tenant_id", tenantId)
    .is("anonymized_at", null)
    .not("tags", "eq", "{}")
    .limit(5000);
  return [...new Set((data ?? []).flatMap((c) => c.tags))].sort((a, b) => a.localeCompare(b));
}
