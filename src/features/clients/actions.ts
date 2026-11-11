"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { dbErrorCode, managerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import {
  cleanCustom,
  clientFieldSchema,
  COLUMNS_COOKIE,
  segmentRulesSchema,
  type ClientField,
  type ClientFieldInput,
  type FieldKind,
  type SegmentRulesInput,
} from "./fields";
import { clientSchema, importClientsSchema, type ClientInput } from "./schema";

const uuid = z.uuid();

export async function saveClient(
  id: string | null,
  input: ClientInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await managerContext();
  if (!ctx || (id && !uuid.safeParse(id).success)) return fail("notAllowed");
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;
  const { supabase, tenant } = ctx;
  const { data: fieldRows } = await supabase
    .from("client_fields")
    .select("id, label, kind, options")
    .eq("tenant_id", tenant.tenantId);
  const fields: ClientField[] = (fieldRows ?? []).map((f) => ({ ...f, kind: f.kind as FieldKind }));

  const row = {
    first_name: v.firstName,
    last_name: v.lastName,
    phone_e164: v.phone,
    email: v.email,
    birthday: v.birthday,
    gender: v.gender,
    source: v.source,
    tags: [...new Set(v.tags)],
    notes: v.notes,
    important_note: v.importantNote,
    preferred_staff_id: v.preferredStaffId,
    blocked_online: v.blockedOnline,
    // only when the form sent them: a card saved before fields existed keeps its values
    ...(v.custom !== undefined && { custom: cleanCustom(v.custom, fields) }),
  };
  const { data, error } = id
    ? await supabase
        .from("clients")
        .update(row)
        .eq("id", id)
        .eq("tenant_id", tenant.tenantId)
        .select("id")
        .single()
    : await supabase
        .from("clients")
        .insert({
          ...row,
          tenant_id: tenant.tenantId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select("id")
        .single();
  if (error)
    return fail(
      error.code === "23505" ? "phoneTaken" : dbErrorCode(error),
      error.code === "23505" ? "phone" : undefined,
    );

  // Marketing consent: store an event only when the state actually changes,
  // so the history shows who changed it and when.
  const { data: state } = await supabase
    .from("client_consent_state")
    .select("channel, granted")
    .eq("client_id", data.id);
  const userId = (await supabase.auth.getUser()).data.user!.id;
  for (const [channel, wanted] of [
    ["sms", v.consentSms],
    ["email", v.consentEmail],
  ] as const) {
    const current = state?.find((s) => s.channel === channel)?.granted ?? false;
    if (current !== wanted) {
      const { error: cErr } = await supabase.from("client_consents").insert({
        tenant_id: tenant.tenantId,
        client_id: data.id,
        channel,
        granted: wanted,
        source: "admin",
        recorded_by: userId,
      });
      if (cErr) return fail(dbErrorCode(cErr));
    }
  }

  revalidatePath(`/${ctx.locale}/clients`);
  return ok({ id: data.id });
}

// Data subject request: everything stored about one client, as JSON. Owner only (RPC checks).
export async function exportClient(clientId: string): Promise<ActionResult<{ json: string }>> {
  const ctx = await managerContext({ read: true });
  if (!ctx || !uuid.safeParse(clientId).success) return fail("notAllowed");
  const { data, error } = await ctx.supabase.rpc("export_client", { p_client: clientId });
  if (error) return fail(dbErrorCode(error));
  return ok({ json: JSON.stringify(data, null, 2) });
}

export async function anonymizeClient(clientId: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(clientId).success) return fail("notAllowed");
  const { error } = await ctx.supabase.rpc("anonymize_client", { p_client: clientId });
  if (error) return fail(dbErrorCode(error));
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(undefined);
}

export async function mergeClients(keepId: string, removeId: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(keepId).success || !uuid.safeParse(removeId).success) return fail("notAllowed");
  const { error } = await ctx.supabase.rpc("merge_clients", { p_keep: keepId, p_remove: removeId });
  if (error) return fail(dbErrorCode(error));
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(undefined);
}

// For the merge picker: other clients matching a search.
export async function searchClients(q: string, excludeId: string) {
  const ctx = await managerContext({ read: true });
  const term = q
    .trim()
    .replace(/[%,()*\\]/g, " ")
    .trim();
  if (!ctx || term.length < 2) return [];
  const digits = term.replace(/\D/g, "");
  const parts = [`first_name.ilike.%${term}%`, `last_name.ilike.%${term}%`];
  if (digits.length >= 3) parts.push(`phone_e164.like.%${digits}%`);
  const { data } = await ctx.supabase
    .from("clients")
    .select("id, first_name, last_name, phone_e164")
    .eq("tenant_id", ctx.tenant.tenantId)
    .is("anonymized_at", null)
    .neq("id", excludeId)
    .or(parts.join(","))
    .limit(8);
  return data ?? [];
}

// Which of these phones already belong to a client (import preview).
export async function existingPhones(phones: string[]): Promise<string[]> {
  const ctx = await managerContext();
  const list = z
    .array(z.string().regex(/^\+[1-9][0-9]{7,14}$/))
    .max(5000)
    .safeParse(phones);
  if (!ctx || !list.success || list.data.length === 0) return [];
  const found: string[] = [];
  for (let i = 0; i < list.data.length; i += 200) {
    const { data } = await ctx.supabase
      .from("clients")
      .select("phone_e164")
      .eq("tenant_id", ctx.tenant.tenantId)
      .in("phone_e164", list.data.slice(i, i + 200));
    found.push(...(data ?? []).map((c) => c.phone_e164!));
  }
  return found;
}

export async function importClients(
  rows: unknown,
): Promise<ActionResult<{ inserted: number; skipped: number }>> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = importClientsSchema.safeParse(rows);
  if (!parsed.success) return fail("invalidInput");
  const { data, error } = await ctx.supabase.rpc("import_clients", {
    p_tenant: ctx.tenant.tenantId,
    p_rows: parsed.data,
  });
  if (error) return fail(dbErrorCode(error));
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(data as { inserted: number; skipped: number });
}

// ----- Clients step 2 (decision 026) -----

/** The quick note from the list: only the client's note changes. */
export async function saveClientNote(clientId: string, notes: string): Promise<ActionResult> {
  const ctx = await managerContext();
  const text = z.string().trim().max(4000, "tooLong").safeParse(notes);
  if (!ctx || !uuid.safeParse(clientId).success) return fail("notAllowed");
  if (!text.success) return fail("tooLong");
  const { data, error } = await ctx.supabase
    .from("clients")
    .update({ notes: text.data || null })
    .eq("id", clientId)
    .eq("tenant_id", ctx.tenant.tenantId)
    .select("id");
  if (error) return fail(dbErrorCode(error));
  if (!data?.length) return fail("notFound");
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(undefined);
}

export async function saveClientField(id: string | null, input: ClientFieldInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || (id && !uuid.safeParse(id).success)) return fail("notAllowed");
  const p = clientFieldSchema.safeParse(input);
  if (!p.success)
    return fail(p.error.issues[0]?.message === "optionsRequired" ? "optionsRequired" : "invalidInput");
  const { supabase, tenant } = ctx;
  if (id) {
    // the kind is fixed once values may exist; only the label and choices change
    const { data, error } = await supabase
      .from("client_fields")
      .update({ label: p.data.label, options: p.data.options })
      .eq("id", id)
      .eq("tenant_id", tenant.tenantId)
      .eq("kind", p.data.kind)
      .select("id");
    if (error) return fail(dbErrorCode(error));
    if (!data?.length) return fail("notFound");
  } else {
    const { count } = await supabase
      .from("client_fields")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.tenantId);
    const { error } = await supabase.from("client_fields").insert({
      tenant_id: tenant.tenantId,
      label: p.data.label,
      kind: p.data.kind,
      options: p.data.options,
      sort_order: count ?? 0,
    });
    if (error) return fail(error.code === "P0006" ? "tooManyFields" : dbErrorCode(error));
  }
  revalidatePath(`/${ctx.locale}/settings/clients`);
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(undefined);
}

/** Removes a field and, with it, its values on every card (the database does that). */
export async function deleteClientField(id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  const { data, error } = await ctx.supabase
    .from("client_fields")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId)
    .select("id");
  if (error) return fail(dbErrorCode(error));
  if (!data?.length) return fail("notFound");
  revalidatePath(`/${ctx.locale}/settings/clients`);
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(undefined);
}

/** Moves a field one place up or down. */
export async function moveClientField(id: string, by: -1 | 1): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success || ![-1, 1].includes(by)) return fail("notAllowed");
  const { data } = await ctx.supabase
    .from("client_fields")
    .select("id")
    .eq("tenant_id", ctx.tenant.tenantId)
    .order("sort_order")
    .order("created_at");
  const ids = (data ?? []).map((f) => f.id);
  const i = ids.indexOf(id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= ids.length) return ok(undefined);
  [ids[i], ids[j]] = [ids[j], ids[i]];
  for (const [n, fid] of ids.entries()) {
    const { error } = await ctx.supabase.from("client_fields").update({ sort_order: n }).eq("id", fid);
    if (error) return fail(dbErrorCode(error));
  }
  revalidatePath(`/${ctx.locale}/settings/clients`);
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(undefined);
}

export async function saveSegmentRules(input: SegmentRulesInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const p = segmentRulesSchema.safeParse(input);
  if (!p.success)
    return p.error.issues.some((i) => i.message === "lostAfterAtRisk")
      ? fail("lostAfterAtRisk", "lostDays")
      : fail("invalidInput");
  const { data, error } = await ctx.supabase
    .from("tenant_settings")
    .update({
      segment_vip_visits: p.data.vipVisits,
      segment_at_risk_days: p.data.atRiskDays,
      segment_lost_days: p.data.lostDays,
    })
    .eq("tenant_id", ctx.tenant.tenantId)
    .select("tenant_id");
  if (error) return fail(dbErrorCode(error));
  if (!data?.length) return fail("notAllowed");
  revalidatePath(`/${ctx.locale}/settings/clients`);
  revalidatePath(`/${ctx.locale}/clients`);
  return ok(undefined);
}

/** Which columns the list shows — remembered in this browser (a cookie, no personal data). */
export async function setClientColumns(columns: string[]): Promise<ActionResult> {
  const list = z
    .array(z.string().regex(/^(?:[a-zA-Z]{2,12}|f:[0-9a-f-]{36})$/))
    .max(40)
    .safeParse(columns);
  if (!list.success) return fail("invalidInput");
  (await cookies()).set(COLUMNS_COOKIE, list.data.join(","), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return ok(undefined);
}
