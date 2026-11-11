"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorCode, managerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { parseMoneyToMinor } from "@/lib/money";
import {
  adjustmentSchema,
  payoutSchema,
  payRateSchema,
  paySchemeSchema,
  type AdjustmentInput,
  type PayoutInput,
  type PayRateInput,
  type PaySchemeInput,
} from "./schema";

// Every action: owner/admin of the active business (server-side), then the
// database decides again — can_use_payroll: revenue rights + the plan includes
// payroll. Every change is written to the audit log by the database.

const uuid = z.uuid();
const done = (locale: string) => revalidatePath(`/${locale}/payroll`, "layout");
const amount = (s: string) => (s === "" ? 0 : parseMoneyToMinor(s));

export async function savePayScheme(staffId: string, input: PaySchemeInput): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = paySchemeSchema.safeParse(input);
  if (!ctx || !uuid.safeParse(staffId).success) return fail("notAllowed");
  if (!p.success) return fail("invalidInput");
  const salary = amount(p.data.salary);
  if (salary === null) return fail("priceInvalid", "salary");
  const { supabase, tenant } = ctx;
  // the pay table first: it refuses when payroll is not in the plan
  const pay = await supabase
    .from("staff_pay")
    .upsert({ tenant_id: tenant.tenantId, staff_id: staffId, salary_minor: salary })
    .select("staff_id");
  if (pay.error) return fail(dbErrorCode(pay.error));
  if (!pay.data?.length) return fail("notAllowed");
  const staff = await supabase
    .from("staff")
    .update({ commission_pct: p.data.defaultPct })
    .eq("id", staffId)
    .eq("tenant_id", tenant.tenantId)
    .select("id");
  if (staff.error) return fail(dbErrorCode(staff.error));
  done(ctx.locale);
  revalidatePath(`/${ctx.locale}/staff/${staffId}`);
  return ok(undefined);
}

export async function addPayRate(staffId: string, input: PayRateInput): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = payRateSchema.safeParse(input);
  if (!ctx || !uuid.safeParse(staffId).success) return fail("notAllowed");
  if (!p.success) return fail("invalidInput");
  const { error } = await ctx.supabase.from("staff_pay_rates").insert({
    tenant_id: ctx.tenant.tenantId,
    staff_id: staffId,
    category_id: p.data.target === "category" ? p.data.targetId : null,
    service_id: p.data.target === "service" ? p.data.targetId : null,
    pct: p.data.pct,
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok(undefined);
}

async function remove(table: "staff_pay_rates" | "pay_adjustments" | "payouts", id: string) {
  const ctx = await managerContext();
  if (!ctx || !uuid.safeParse(id).success) return fail("notAllowed");
  const { data, error } = await ctx.supabase
    .from(table)
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId)
    .select("id");
  if (error) return fail(dbErrorCode(error));
  if (!data?.length) return fail("notFound");
  done(ctx.locale);
  return ok(undefined);
}

export async function removePayRate(id: string): Promise<ActionResult> {
  return remove("staff_pay_rates", id);
}

export async function addAdjustment(input: AdjustmentInput): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = adjustmentSchema.safeParse(input);
  if (!ctx) return fail("notAllowed");
  if (!p.success) return fail("invalidInput");
  const value = parseMoneyToMinor(p.data.amount);
  if (!value) return fail("priceInvalid", "amount");
  const { error } = await ctx.supabase.from("pay_adjustments").insert({
    tenant_id: ctx.tenant.tenantId,
    staff_id: p.data.staffId,
    month: `${p.data.month}-01`,
    kind: p.data.kind,
    amount_minor: value,
    note: p.data.note,
    created_by: (await ctx.supabase.auth.getUser()).data.user?.id ?? null,
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok(undefined);
}

export async function removeAdjustment(id: string): Promise<ActionResult> {
  return remove("pay_adjustments", id);
}

export async function addPayout(input: PayoutInput): Promise<ActionResult> {
  const ctx = await managerContext();
  const p = payoutSchema.safeParse(input);
  if (!ctx) return fail("notAllowed");
  if (!p.success) return fail("invalidInput");
  const value = parseMoneyToMinor(p.data.amount);
  if (!value) return fail("priceInvalid", "amount");
  const { error } = await ctx.supabase.from("payouts").insert({
    tenant_id: ctx.tenant.tenantId,
    staff_id: p.data.staffId,
    month: `${p.data.month}-01`,
    amount_minor: value,
    method: p.data.method,
    paid_on: p.data.paidOn,
    note: p.data.note,
    created_by: (await ctx.supabase.auth.getUser()).data.user?.id ?? null,
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok(undefined);
}

export async function removePayout(id: string): Promise<ActionResult> {
  return remove("payouts", id);
}
