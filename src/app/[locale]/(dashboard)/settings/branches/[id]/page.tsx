import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import QRCode from "qrcode";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { Week } from "@/components/week-editor";
import {
  BranchDetailsCard,
  BranchHoursCard,
  BranchServicesCard,
  BranchStateCard,
  type BranchService,
} from "@/features/branches/components/branch-forms";
import { ShareCard } from "@/features/settings/components/share-card";
import { bookingUrl, requireSettingsAccess } from "@/features/settings/section-page";
import { Link } from "@/i18n/navigation";
import { localized } from "@/lib/i18n-text";
import { createClient } from "@/lib/supabase/server";
import { trimSeconds } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/branches/[id]">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "branches" });
  return { title: t("details.title") };
}

// One branch: details, its own booking link + QR, opening hours, services and prices.
export default async function BranchPage({ params }: PageProps<"/[locale]/settings/branches/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const t = await getTranslations("branches");
  const db = await createClient();
  const [{ data: b }, { data: services }, { data: settings }, { data: categories }] = await Promise.all([
    db
      .from("locations")
      .select(
        "id, name, address, phone, slug, is_primary, active, location_hours(weekday, start_time, end_time)",
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("id", id)
      .maybeSingle(),
    db
      .from("services")
      .select(
        "id, name_i18n, category_id, price_type, price_minor, price_max_minor, sort_order, service_variants(id), service_locations(location_id, offered, price_minor, price_max_minor)",
      )
      .eq("tenant_id", tenant.tenantId)
      .eq("active", true)
      .order("sort_order"),
    db.from("tenant_settings").select("phone").eq("tenant_id", tenant.tenantId).single(),
    db.from("service_categories").select("id, name_i18n").eq("tenant_id", tenant.tenantId),
  ]);
  if (!b) notFound();

  const hours: Week = {};
  for (const h of [...b.location_hours].sort((x, y) => x.start_time.localeCompare(y.start_time)))
    (hours[h.weekday] ??= []).push({ start: trimSeconds(h.start_time), end: trimSeconds(h.end_time) });

  const cat = new Map((categories ?? []).map((c) => [c.id, localized(c.name_i18n, locale)]));
  const list: BranchService[] = (services ?? []).map((s) => {
    const here = s.service_locations.find((x) => x.location_id === id);
    return {
      id: s.id,
      name: localized(s.name_i18n, locale),
      category: s.category_id ? (cat.get(s.category_id) ?? null) : null,
      priceMinor: s.price_minor,
      priceMaxMinor: s.price_max_minor,
      priceType: s.price_type as BranchService["priceType"],
      hasVariants: s.service_variants.length > 0,
      offered: here?.offered ?? true,
      branchPriceMinor: here?.price_minor ?? null,
      branchPriceMaxMinor: here?.price_max_minor ?? null,
    };
  });

  const url = b.slug ? `${bookingUrl(tenant.slug)}?branch=${b.slug}` : null;
  const qrSvg = url ? await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }) : "";

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <Button variant="ghost" asChild className="-ml-2 h-9 self-start">
        <Link href="/settings/branches">
          <ArrowLeft aria-hidden />
          {t("back")}
        </Link>
      </Button>
      <PageHeader title={b.name} description={b.is_primary ? t("mainHint") : undefined} />
      <BranchDetailsCard
        id={b.id}
        initial={{
          name: b.name,
          address: b.address ?? "",
          phone: b.phone ?? (b.is_primary ? (settings?.phone ?? "") : ""),
          slug: b.slug ?? "",
        }}
      />
      {url && b.active && (
        <ShareCard
          url={url}
          slug={`${tenant.slug}-${b.slug}`}
          qrSvg={qrSvg}
          title={t("link.title")}
          hint={t("link.hint")}
        />
      )}
      <BranchHoursCard id={b.id} initial={hours} />
      <BranchServicesCard id={b.id} services={list} />
      {!b.is_primary && <BranchStateCard id={b.id} active={b.active} />}
    </div>
  );
}
