import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingFlow } from "@/features/public-booking/components/booking-flow";
import { getPublicBusiness } from "@/features/public-booking/queries";

// The booking form for a frame on the salon's own website (decision 023): the
// same flow as /book/[slug], without the website parts (cover, team, gallery,
// map) — the salon's site already has those. This is the only page other sites
// may frame (see next.config.ts).
export async function generateMetadata({ params }: PageProps<"/[locale]/embed/[slug]">) {
  const { locale, slug } = await params;
  const business = await getPublicBusiness(slug, locale);
  const t = await getTranslations({ locale, namespace: "publicBooking" });
  return {
    title: business ? `${business.name} — ${t("embedTitle")}` : t("notFoundTitle"),
    robots: { index: false },
  };
}

export default async function EmbedBookingPage({ params }: PageProps<"/[locale]/embed/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const business = await getPublicBusiness(slug, locale);
  if (!business) notFound();
  const { tenantId: _id, ...visible } = business;
  void _id;

  return (
    <div data-site-theme={visible.theme} className="flex flex-col gap-4">
      <BookingFlow
        business={visible}
        embedded
        header={<h1 className="text-xl font-semibold">{visible.name}</h1>}
      />
    </div>
  );
}
