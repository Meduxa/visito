import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookingFlow } from "@/features/public-booking/components/booking-flow";
import { BranchPicker } from "@/features/public-booking/components/branch-picker";
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

export default async function EmbedBookingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/embed/[slug]">) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const branch = typeof sp.branch === "string" ? sp.branch : null;
  const business = await getPublicBusiness(slug, locale, branch);
  if (!business) notFound();
  const { tenantId: _id, locationId: _loc, ...visible } = business;
  void _id;
  void _loc;

  return (
    <div data-site-theme={visible.theme} className="flex flex-col gap-4">
      {visible.branches.length > 0 && !visible.branch ? (
        <>
          <h1 className="text-xl font-semibold">{visible.name}</h1>
          <BranchPicker branches={visible.branches} basePath={`/embed/${visible.slug}`} />
        </>
      ) : (
        <BookingFlow
          key={visible.branch ?? ""}
          business={visible}
          embedded
          header={<h1 className="text-xl font-semibold">{visible.name}</h1>}
          changeBranchHref={visible.branch ? `/embed/${visible.slug}` : undefined}
        />
      )}
    </div>
  );
}
