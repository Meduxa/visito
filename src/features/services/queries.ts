import "server-only";
import { asI18n, type I18nText } from "@/lib/i18n-text";
import { createClient } from "@/lib/supabase/server";

export type Category = { id: string; name: I18nText; sortOrder: number };

export type Extra = { id: string; name: I18nText; priceMinor: number; durationMin: number };

export type Service = {
  id: string;
  categoryId: string | null;
  name: I18nText;
  description: I18nText;
  priceType: "fixed" | "from" | "range";
  priceMinor: number;
  priceMaxMinor: number | null;
  durationMin: number;
  bufferAfterMin: number;
  active: boolean;
  bookableOnline: boolean;
  color: string | null;
  resourceType: string | null;
  followUpServiceId: string | null; // decision 037
  followUpAfterMin: number;
  variants: Extra[];
  addons: Extra[];
  staffCount: number;
};

const extra = (r: { id: string; name_i18n: unknown; price_minor: number; duration_min: number }): Extra => ({
  id: r.id,
  name: asI18n(r.name_i18n as never),
  priceMinor: r.price_minor,
  durationMin: r.duration_min,
});

// tenantId always comes from getActiveTenant() on the server; RLS limits rows anyway.
export async function getCatalog(tenantId: string): Promise<{ categories: Category[]; services: Service[] }> {
  const supabase = await createClient();
  const [cats, services] = await Promise.all([
    supabase
      .from("service_categories")
      .select("id, name_i18n, sort_order")
      .eq("tenant_id", tenantId)
      .order("sort_order"),
    supabase
      .from("services")
      .select(
        "*, service_variants(id, name_i18n, price_minor, duration_min, sort_order), service_addons(id, name_i18n, price_minor, duration_min, sort_order), staff_services(count)",
      )
      .eq("tenant_id", tenantId)
      .order("sort_order"),
  ]);
  if (cats.error || services.error) throw new Error("Could not load services");

  return {
    categories: cats.data.map((c) => ({ id: c.id, name: asI18n(c.name_i18n), sortOrder: c.sort_order })),
    services: services.data.map((s) => ({
      id: s.id,
      categoryId: s.category_id,
      name: asI18n(s.name_i18n),
      description: asI18n(s.description_i18n),
      priceType: s.price_type as Service["priceType"],
      priceMinor: s.price_minor,
      priceMaxMinor: s.price_max_minor,
      durationMin: s.duration_min,
      bufferAfterMin: s.buffer_after_min,
      active: s.active,
      bookableOnline: s.bookable_online,
      color: s.color,
      resourceType: s.resource_type,
      followUpServiceId: s.followup_service_id,
      followUpAfterMin: s.followup_after_min,
      variants: [...s.service_variants].sort((x, y) => x.sort_order - y.sort_order).map(extra),
      addons: [...s.service_addons].sort((x, y) => x.sort_order - y.sort_order).map(extra),
      staffCount: (s.staff_services as unknown as { count: number }[])[0]?.count ?? 0,
    })),
  };
}
