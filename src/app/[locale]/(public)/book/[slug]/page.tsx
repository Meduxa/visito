import { CalendarOff, Phone } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingFlow } from "@/features/public-booking/components/booking-flow";
import { BranchPicker } from "@/features/public-booking/components/branch-picker";
import { BusinessHeader } from "@/features/public-booking/components/business-header";
import { Button } from "@/components/ui/button";
import { getPausedBusiness, getPublicBusiness } from "@/features/public-booking/queries";
import { PublicReviewsBlock } from "@/features/reviews/components/public-reviews";
import { publicReviews } from "@/features/reviews/queries";

export async function generateMetadata({ params }: PageProps<"/[locale]/book/[slug]">) {
  const { locale, slug } = await params;
  const business = await getPublicBusiness(slug, locale);
  const t = await getTranslations({ locale, namespace: "publicBooking" });
  if (!business) {
    const paused = await getPausedBusiness(slug);
    return { title: paused ? paused.name : t("notFoundTitle") };
  }
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
  if (!business) {
    const paused = await getPausedBusiness(slug);
    if (!paused) notFound();
    const t = await getTranslations("publicBooking");
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card px-6 py-10 text-center">
        <CalendarOff aria-hidden className="size-8 text-muted-foreground" />
        <h1 className="text-lg font-semibold">{paused.name}</h1>
        <p className="text-sm text-muted-foreground">{t("pausedBody")}</p>
        {paused.phone && (
          <Button asChild className="h-11">
            <a href={`tel:${paused.phone}`}>
              <Phone aria-hidden />
              {t("call")}
            </a>
          </Button>
        )}
      </div>
    );
  }
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
