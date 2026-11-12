import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { ReviewsView } from "@/features/reviews/components/reviews-view";
import { listReviews } from "@/features/reviews/queries";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";

export async function generateMetadata({ params }: PageProps<"/[locale]/reviews">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "reviews" });
  return { title: t("title") };
}

// Reviews (decision 030): managers see all and reply/hide; staff see the ones about their visits.
export default async function ReviewsPage({ params }: PageProps<"/[locale]/reviews">) {
  setRequestLocale((await params).locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const t = await getTranslations("reviews");
  const db = await createClient();
  const [{ rows, average, byStars }, { data: s }] = await Promise.all([
    listReviews(tenant.tenantId),
    db.from("tenant_settings").select("reviews_ask").eq("tenant_id", tenant.tenantId).single(),
  ]);
  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ReviewsView
        rows={rows}
        average={average}
        byStars={byStars}
        canManage={canManage(tenant.role)}
        asking={!!s?.reviews_ask}
      />
    </div>
  );
}
