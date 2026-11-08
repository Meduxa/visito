import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { PhotosCard } from "@/features/settings/components/photos-card";
import { WebsiteCard } from "@/features/settings/components/website-card";
import { bookingUrl, photoUrl, requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import type { SiteTheme } from "@/features/settings/website";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/website">) {
  return { title: (await sectionText((await params).locale, "website")).title };
}

// Settings → Website: what clients see on the business's own page.
export default async function WebsiteSettingsPage({ params }: PageProps<"/[locale]/settings/website">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  const db = await createClient();
  const [settings, photos] = await Promise.all([
    db
      .from("tenant_settings")
      .select("site_about, site_instagram, site_facebook, site_theme, site_cover_path, site_logo_path")
      .eq("tenant_id", tenant.tenantId)
      .single(),
    db.from("business_photos").select("id, path").eq("tenant_id", tenant.tenantId).order("sort_order"),
  ]);
  if (settings.error) throw new Error("Could not load settings");
  const s = settings.data;
  const about = s.site_about as Partial<Record<"ka" | "en" | "ru", string>>;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "website")} />
      <WebsiteCard
        tenantId={tenant.tenantId}
        url={bookingUrl(tenant.slug)}
        data={{
          about: { ka: about.ka ?? "", en: about.en ?? "", ru: about.ru ?? "" },
          instagram: s.site_instagram ?? "",
          facebook: s.site_facebook ?? "",
          theme: s.site_theme as SiteTheme,
          coverUrl: s.site_cover_path ? photoUrl(s.site_cover_path) : null,
          logoUrl: s.site_logo_path ? photoUrl(s.site_logo_path) : null,
        }}
      />
      <PhotosCard
        tenantId={tenant.tenantId}
        photos={(photos.data ?? []).map((p) => ({ id: p.id, url: photoUrl(p.path) }))}
      />
    </div>
  );
}
