import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingFlow } from "@/features/public-booking/components/booking-flow";
import { BusinessHeader } from "@/features/public-booking/components/business-header";
import { getPublicBusiness } from "@/features/public-booking/queries";
import { PublicReviewsBlock } from "@/features/reviews/components/public-reviews";
import { publicReviews } from "@/features/reviews/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/book/[slug]">) {
  const { locale, slug } = await params;
  const business = await getPublicBusiness(slug, locale);
  const t = await getTranslations({ locale, namespace: "publicBooking" });
  if (!business) return { title: t("notFoundTitle") };
  // what Instagram, Facebook and messengers show when the link is shared
  const description = business.about.slice(0, 200) || business.address || undefined;
  return {
    title: `${business.name} — ${t("title")}`,
    description,
    openGraph: {
      title: business.name,
      description,
      images: business.coverUrl ? [business.coverUrl] : undefined,
    },
  };
}

export default async function PublicBookingPage({ params }: PageProps<"/[locale]/book/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const business = await getPublicBusiness(slug, locale);
  if (!business) notFound();
  const reviews = await publicReviews(business.tenantId); // null when the business hides them
  const { tenantId: _id, ...visible } = business; // the browser needs no ids beyond the slug
  void _id;

  return (
    <div data-site-theme={visible.theme} data-wide className="flex flex-col gap-4">
      <BookingFlow business={visible} header={<BusinessHeader business={visible} />} />
      {reviews && <PublicReviewsBlock reviews={reviews} />}
    </div>
  );
}
