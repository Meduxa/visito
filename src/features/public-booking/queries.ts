import "server-only";
import { cache } from "react";
import { localized } from "@/lib/i18n-text";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sortBranches, usableBranches } from "@/features/branches/queries";
import { trimSeconds } from "@/lib/time";

// Everything the public page shows about a business — and nothing else. Read
// with the server key (decision 007), always filtered by the tenant found from
// the slug; only public fields leave this module.

export type PublicService = {
  key: string; // serviceId or serviceId:variantId
  serviceId: string;
  variantId: string | null;
  name: string;
  description: string;
  categoryId: string | null;
  durationMin: number;
  priceType: "fixed" | "from" | "range";
  priceMinor: number;
  priceMaxMinor: number | null;
  staffIds: string[];
};

export type PublicStaff = {
  id: string;
  name: string;
  position: string | null;
  bio: string | null;
  photoUrl: string | null;
};

export type PublicBranch = { slug: string; name: string; address: string | null };

export type PublicBusiness = {
  tenantId: string;
  locationId: string; // the branch being booked (server only)
  slug: string;
  // Several branches (decision 032): the client picks one first. `branch` is its
  // link name, null until picked; then hours, address, phone, services, prices
  // and people below are that branch's.
  branch: string | null;
  branches: PublicBranch[]; // empty for one-branch businesses
  name: string;
  type: "salon" | "dental";
  timeZone: string;
  phone: string | null;
  address: string | null;
  otpRequired: boolean;
  showPrices: boolean; // false: prices are not sent to the browser at all
  maxDaysAhead: number;
  cancelWindowMin: number;
  hours: Record<number, [string, string][]>; // ISO weekday → local times
  categories: { id: string; name: string }[];
  services: PublicService[];
  staff: PublicStaff[];
  photos: string[]; // public URLs, in order
  // the business's small website (Settings → Your website)
  about: string;
  coverUrl: string | null;
  logoUrl: string | null;
  instagram: string | null;
  facebook: string | null;
  theme: string;
};

export const getPublicBusiness = cache(
  async (slug: string, locale: string, branchSlug?: string | null): Promise<PublicBusiness | null> => {
    if (!/^[a-z0-9-]{3,50}$/.test(slug)) return null;
    const db = createAdminClient();
    const { data: tenant } = await db
      .from("tenants")
      .select("id, slug, name, type, timezone, status, plans(max_locations)")
      .eq("slug", slug)
      .in("status", ["trial", "active", "past_due"])
      .maybeSingle();
    if (!tenant) return null;
    const id = tenant.id;

    const today = new Date().toISOString().slice(0, 10);
    const [settings, locations, categories, services, staff, links, photos, schedules, overrides, atBranch] =
      await Promise.all([
        db
          .from("tenant_settings")
          .select(
            "phone, online_otp_required, online_show_prices, max_days_ahead, cancel_window_min, site_about, site_cover_path, site_logo_path, site_instagram, site_facebook, site_theme",
          )
          .eq("tenant_id", id)
          .single(),
        db
          .from("locations")
          .select(
            "id, name, slug, address, phone, is_primary, active, sort_order, location_hours(weekday, start_time, end_time)",
          )
          .eq("tenant_id", id),
        db.from("service_categories").select("id, name_i18n").eq("tenant_id", id).order("sort_order"),
        db
          .from("services")
          .select(
            "id, name_i18n, description_i18n, category_id, duration_min, price_type, price_minor, price_max_minor, service_variants(id, name_i18n, duration_min, price_minor, sort_order)",
          )
          .eq("tenant_id", id)
          .eq("active", true)
          .eq("bookable_online", true)
          .order("sort_order"),
        db
          .from("staff")
          .select("id, display_name, position, bio, photo_path")
          .eq("tenant_id", id)
          .eq("active", true)
          .eq("bookable_online", true)
          .order("sort_order")
          .order("display_name"),
        db.from("staff_services").select("staff_id, service_id").eq("tenant_id", id),
        db.from("business_photos").select("path").eq("tenant_id", id).order("sort_order").limit(12),
        db.from("staff_schedules").select("staff_id, location_id").eq("tenant_id", id),
        db
          .from("staff_schedule_overrides")
          .select("staff_id, location_id")
          .eq("tenant_id", id)
          .eq("is_day_off", false)
          .gte("date", today),
        db
          .from("service_locations")
          .select("service_id, location_id, offered, price_minor, price_max_minor")
          .eq("tenant_id", id),
      ]);

    // the branches clients can choose (active, within the plan's limit), main first
    const max = (tenant.plans as { max_locations: number | null } | null)?.max_locations ?? null;
    const usable = usableBranches(
      sortBranches(
        (locations.data ?? []).map((l) => ({ ...l, isPrimary: l.is_primary, sortOrder: l.sort_order })),
      ),
      max,
    );
    const primary = usable[0];
    if (!primary) return null;
    const multi = usable.length > 1;
    const chosen = multi ? usable.find((l) => l.slug && l.slug === branchSlug) : primary;
    const location = chosen ?? primary;
    const at = (loc: string | null) => loc ?? primary.id;
    // with branches: only the people who work in this branch (weekly or on a coming date)
    const worksHere = new Set(
      [...(schedules.data ?? []), ...(overrides.data ?? [])]
        .filter((x) => at(x.location_id) === location.id)
        .map((x) => x.staff_id),
    );
    const here = new Map(
      (atBranch.data ?? []).filter((x) => x.location_id === location.id).map((x) => [x.service_id, x]),
    );

    const staffIds = new Set(
      (staff.data ?? []).map((s) => s.id).filter((sid) => !multi || worksHere.has(sid)),
    );
    const performers = (serviceId: string) =>
      (links.data ?? [])
        .filter((l) => l.service_id === serviceId && staffIds.has(l.staff_id))
        .map((l) => l.staff_id);

    const list: PublicService[] = [];
    for (const s of services.data ?? []) {
      if (here.get(s.id)?.offered === false) continue; // switched off in this branch
      const own = here.get(s.id)?.price_minor ?? null; // this branch's price
      const who = performers(s.id);
      if (!who.length) continue; // nobody can do it online
      const base = {
        serviceId: s.id,
        description: localized(s.description_i18n, locale),
        categoryId: s.category_id,
        staffIds: who,
      };
      const variants = [...s.service_variants].sort((a, b) => a.sort_order - b.sort_order);
      if (!variants.length) {
        list.push({
          ...base,
          key: s.id,
          variantId: null,
          name: localized(s.name_i18n, locale),
          durationMin: s.duration_min,
          priceType: s.price_type as PublicService["priceType"],
          priceMinor: own ?? s.price_minor,
          priceMaxMinor: own !== null ? (here.get(s.id)?.price_max_minor ?? null) : s.price_max_minor,
        });
      } else {
        for (const v of variants)
          list.push({
            ...base,
            key: `${s.id}:${v.id}`,
            variantId: v.id,
            name: `${localized(s.name_i18n, locale)} — ${localized(v.name_i18n, locale)}`,
            durationMin: v.duration_min,
            priceType: "fixed",
            priceMinor: v.price_minor,
            priceMaxMinor: null,
          });
      }
    }

    const hours: PublicBusiness["hours"] = {};
    for (const h of location.location_hours)
      (hours[h.weekday] ??= []).push([trimSeconds(h.start_time), trimSeconds(h.end_time)]);
    for (const k of Object.keys(hours)) hours[Number(k)].sort((a, b) => a[0].localeCompare(b[0]));

    // hidden prices never leave the server
    const showPrices = settings.data?.online_show_prices ?? true;
    if (!showPrices) for (const s of list) Object.assign(s, { priceMinor: 0, priceMaxMinor: null });

    const url = publicEnv.NEXT_PUBLIC_SUPABASE_URL;
    return {
      tenantId: id,
      locationId: location.id,
      slug: tenant.slug,
      branch: multi ? (chosen?.slug ?? null) : null,
      branches: multi
        ? usable.filter((l) => l.slug).map((l) => ({ slug: l.slug!, name: l.name, address: l.address }))
        : [],
      name: tenant.name,
      type: tenant.type as PublicBusiness["type"],
      timeZone: tenant.timezone,
      phone: location.is_primary
        ? (settings.data?.phone ?? location.phone ?? null)
        : (location.phone ?? settings.data?.phone ?? null),
      address: location.address ?? null,
      otpRequired: settings.data?.online_otp_required ?? true,
      showPrices,
      maxDaysAhead: settings.data?.max_days_ahead ?? 60,
      cancelWindowMin: settings.data?.cancel_window_min ?? 0,
      hours,
      categories: (categories.data ?? []).map((c) => ({ id: c.id, name: localized(c.name_i18n, locale) })),
      services: list,
      photos: (photos.data ?? []).map((x) => `${url}/storage/v1/object/public/business-photos/${x.path}`),
      about: localized(settings.data?.site_about, locale),
      coverUrl: settings.data?.site_cover_path
        ? `${url}/storage/v1/object/public/business-photos/${settings.data.site_cover_path}`
        : null,
      logoUrl: settings.data?.site_logo_path
        ? `${url}/storage/v1/object/public/business-photos/${settings.data.site_logo_path}`
        : null,
      instagram: settings.data?.site_instagram ?? null,
      facebook: settings.data?.site_facebook ?? null,
      theme: settings.data?.site_theme ?? "emerald",
      staff: (staff.data ?? [])
        .filter((s) => list.some((x) => x.staffIds.includes(s.id)))
        .map((s) => ({
          id: s.id,
          name: s.display_name,
          position: s.position,
          bio: s.bio,
          photoUrl: s.photo_path ? `${url}/storage/v1/object/public/staff-photos/${s.photo_path}` : null,
        })),
    };
  },
);

/** What the browser receives: no tenant or branch id. */
export type PublicBusinessView = Omit<PublicBusiness, "tenantId" | "locationId">;
