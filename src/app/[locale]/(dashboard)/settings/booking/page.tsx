import { setRequestLocale } from "next-intl/server";
import QRCode from "qrcode";
import { PageHeader } from "@/components/page-header";
import { BookingRulesCard } from "@/features/settings/components/settings-view";
import { EmbedCard } from "@/features/settings/components/embed-card";
import { ShareCard } from "@/features/settings/components/share-card";
import { bookingUrl, embedUrl, requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/booking">) {
  return { title: (await sectionText((await params).locale, "booking")).title };
}

// Settings → Online booking: the link and QR code, the booking rules, and the
// code for putting booking on the salon's own website.
export default async function BookingSettingsPage({ params }: PageProps<"/[locale]/settings/booking">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  const db = await createClient();
  const { data: s, error } = await db
    .from("tenant_settings")
    .select(
      "min_notice_min, max_days_ahead, cancel_window_min, slot_step_min, online_requires_approval, online_otp_required, online_show_prices, online_max_upcoming",
    )
    .eq("tenant_id", tenant.tenantId)
    .single();
  if (error) throw new Error("Could not load settings");
  const url = bookingUrl(tenant.slug);
  const qrSvg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "booking")} />
      <ShareCard url={url} slug={tenant.slug} qrSvg={qrSvg} />
      <BookingRulesCard
        initial={{
          minNoticeHours: Math.round(s.min_notice_min / 60),
          maxDaysAhead: s.max_days_ahead,
          cancelWindowHours: Math.round(s.cancel_window_min / 60),
          slotStepMin: s.slot_step_min,
          onlineRequiresApproval: s.online_requires_approval,
          onlineOtpRequired: s.online_otp_required,
          onlineShowPrices: s.online_show_prices,
          maxUpcoming: s.online_max_upcoming,
        }}
      />
      <EmbedCard embedUrl={embedUrl(tenant.slug, locale)} bookingUrl={url} name={tenant.name} />
    </div>
  );
}
