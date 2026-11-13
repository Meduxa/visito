import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingFlow } from "@/features/public-booking/components/booking-flow";
import { BranchPicker } from "@/features/public-booking/components/branch-picker";
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

export default async function PublicBookingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/book/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const branch = typeof sp.branch === "string" ? sp.branch : null;
  const business = await getPublicBusiness(slug, locale, branch);
  if (!business) notFound();
  const reviews = await publicReviews(business.tenantId); // null when the business hides them
  const { tenantId: _id, locationId: _loc, ...visible } = business; // the browser needs no ids beyond the slug
  void _id;
  void _loc;
  const header = <BusinessHeader business={visible} />;

  return (
    <div data-site-theme={visible.theme} data-wide className="flex flex-col gap-4">
      {visible.branches.length > 0 && !visible.branch ? (
        <>
          {header}
          <BranchPicker branches={visible.branches} basePath={`/book/${visible.slug}`} />
        </>
      ) : (
        <BookingFlow
          key={visible.branch ?? ""}
          business={visible}
          header={header}
          changeBranchHref={visible.branch ? `/book/${visible.slug}` : undefined}
        />
      )}
      {reviews && <PublicReviewsBlock reviews={reviews} />}
    </div>
  );
}
