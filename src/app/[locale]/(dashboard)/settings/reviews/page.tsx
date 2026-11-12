import { setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ReviewSettingsCard } from "@/features/reviews/components/review-settings";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/reviews">) {
  return { title: (await sectionText((await params).locale, "reviews")).title };
}

// Settings → Reviews (decision 030): ask after a visit by SMS, when, and show them on the booking page.
export default async function ReviewSettingsPage({ params }: PageProps<"/[locale]/settings/reviews">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  const { data: s, error } = await (
    await createClient()
  )
    .from("tenant_settings")
    .select("reviews_ask, reviews_delay_hours, reviews_public")
    .eq("tenant_id", tenant.tenantId)
    .single();
  if (error) throw new Error("Could not load settings");
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "reviews")} />
      <ReviewSettingsCard
        initial={{ ask: s.reviews_ask, delayHours: s.reviews_delay_hours, showOnPage: s.reviews_public }}
      />
    </div>
  );
}
