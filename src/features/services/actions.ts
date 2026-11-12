"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dbErrorCode, managerContext } from "@/lib/action-context";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { compactI18n } from "@/lib/i18n-text";
import {
  categorySchema,
  extraSchema,
  importSchema,
  serviceSchema,
  type CategoryInput,
  type ExtraInput,
  type ServiceInput,
} from "./schema";

const done = (locale: string) => revalidatePath(`/${locale}/services`);

type Ctx = NonNullable<Awaited<ReturnType<typeof managerContext>>>;

async function nextSortOrder(ctx: Ctx, table: "services" | "service_categories") {
  const { data } = await ctx.supabase
    .from(table)
    .select("sort_order")
    .eq("tenant_id", ctx.tenant.tenantId)
    .order("sort_order", { ascending: false })
    .limit(1);
  return (data?.[0]?.sort_order ?? 0) + 1;
}

export async function saveService(
  id: string | null,
  input: ServiceInput,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const v = parsed.data;

  const row = {
    category_id: v.categoryId,
    name_i18n: compactI18n(v.name),
    description_i18n: compactI18n(v.description),
    price_type: v.priceType,
    price_minor: v.price,
    price_max_minor: v.priceMaxMinor,
    duration_min: v.durationMin,
    buffer_after_min: v.bufferAfterMin,
    active: v.active,
    bookable_online: v.bookableOnline,
    color: v.color,
    resource_type: v.resourceType,
  };

  const { supabase, tenant } = ctx;
  const query = id
    ? supabase.from("services").update(row).eq("id", id).eq("tenant_id", tenant.tenantId)
    : supabase
        .from("services")
        .insert({ ...row, tenant_id: tenant.tenantId, sort_order: await nextSortOrder(ctx, "services") });
  const { data, error } = await query.select("id").single();
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok({ id: data.id });
}

export async function deleteService(id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !z.uuid().safeParse(id).success) return fail("notAllowed");
  const { error } = await ctx.supabase
    .from("services")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail(dbErrorCode(error));
  await ctx.supabase.rpc("log_audit", {
    p_tenant: ctx.tenant.tenantId,
    p_action: "service.deleted",
    p_entity: "service",
    p_entity_id: id,
  });
  done(ctx.locale);
  return ok(undefined);
}

// Variants (e.g. hair length) and add-ons (e.g. + mask) share one shape.
export async function saveExtra(
  kind: "variant" | "addon",
  serviceId: string,
  id: string | null,
  input: ExtraInput,
): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !z.uuid().safeParse(serviceId).success) return fail("notAllowed");
  const parsed = extraSchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  if (kind === "variant" && parsed.data.durationMin < 5) return fail("invalidInput");

  const table = kind === "variant" ? "service_variants" : "service_addons";
  const row = {
    name_i18n: compactI18n(parsed.data.name),
    price_minor: parsed.data.price,
    duration_min: parsed.data.durationMin,
  };
  const { error } = id
    ? await ctx.supabase.from(table).update(row).eq("id", id).eq("tenant_id", ctx.tenant.tenantId)
    : await ctx.supabase
        .from(table)
        .insert({ ...row, service_id: serviceId, tenant_id: ctx.tenant.tenantId });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok(undefined);
}

export async function deleteExtra(kind: "variant" | "addon", id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !z.uuid().safeParse(id).success) return fail("notAllowed");
  const table = kind === "variant" ? "service_variants" : "service_addons";
  const { error } = await ctx.supabase.from(table).delete().eq("id", id).eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok(undefined);
}

export async function saveCategory(id: string | null, input: CategoryInput): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return fail("invalidInput");
  const name_i18n = compactI18n(parsed.data.name);
  const { supabase, tenant } = ctx;

  let error;
  if (id) {
    ({ error } = await supabase
      .from("service_categories")
      .update({ name_i18n })
      .eq("id", id)
      .eq("tenant_id", tenant.tenantId));
  } else {
    ({ error } = await supabase.from("service_categories").insert({
      tenant_id: tenant.tenantId,
      name_i18n,
      sort_order: await nextSortOrder(ctx, "service_categories"),
    }));
  }
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok(undefined);
}

// Services in a deleted category stay, without a category.
export async function deleteCategory(id: string): Promise<ActionResult> {
  const ctx = await managerContext();
  if (!ctx || !z.uuid().safeParse(id).success) return fail("notAllowed");
  const { error } = await ctx.supabase
    .from("service_categories")
    .delete()
    .eq("id", id)
    .eq("tenant_id", ctx.tenant.tenantId);
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok(undefined);
}

// Saves the order shown in the UI (ids top to bottom).
export async function reorderCategories(ids: string[]): Promise<ActionResult> {
  const ctx = await managerContext();
  const parsed = z.array(z.uuid()).max(200).safeParse(ids);
  if (!ctx || !parsed.success) return fail("notAllowed");
  for (const [i, id] of parsed.data.entries()) {
    const { error } = await ctx.supabase
      .from("service_categories")
      .update({ sort_order: i + 1 })
      .eq("id", id)
      .eq("tenant_id", ctx.tenant.tenantId);
    if (error) return fail(dbErrorCode(error));
  }
  done(ctx.locale);
  return ok(undefined);
}

export async function importServices(rows: unknown): Promise<ActionResult<{ count: number }>> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = importSchema.safeParse(rows);
  if (!parsed.success) return fail("invalidInput");
  const { data, error } = await ctx.supabase.rpc("import_services", {
    p_tenant: ctx.tenant.tenantId,
    p_locale: ctx.locale,
    p_rows: parsed.data,
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok({ count: data });
}

// ----- Ready services by business type (decision 028) -----

const t3 = z.object({
  ka: z.string().trim().min(1).max(120),
  en: z.string().trim().min(1).max(120),
  ru: z.string().trim().min(1).max(120),
});
const templateRows = z
  .array(
    z.object({
      category: t3,
      name: t3,
      price_minor: z.number().int().min(0).max(100_000_000),
      price_type: z.enum(["fixed", "from"]),
      duration_min: z.number().int().min(5).max(720),
    }),
  )
  .min(1)
  .max(100);

/** Adds the chosen ready services (names in ka/en/ru); ones that already exist are skipped. */
export async function addTemplateServices(rows: unknown): Promise<ActionResult<{ count: number }>> {
  const ctx = await managerContext();
  if (!ctx) return fail("notAllowed");
  const parsed = templateRows.safeParse(rows);
  if (!parsed.success) return fail("invalidInput");
  const { data, error } = await ctx.supabase.rpc("add_template_services", {
    p_tenant: ctx.tenant.tenantId,
    p_rows: parsed.data,
  });
  if (error) return fail(dbErrorCode(error));
  done(ctx.locale);
  return ok({ count: data ?? 0 });
}
