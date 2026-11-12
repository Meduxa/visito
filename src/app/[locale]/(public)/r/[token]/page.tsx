import { formatInTimeZone } from "date-fns-tz";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { reviewLinkView } from "@/features/reviews/actions";
import { ReviewForm } from "@/features/reviews/components/review-form";
import { Link } from "@/i18n/navigation";
import { fullDate } from "@/lib/date-format";

// The private review link from the SMS after a visit (decision 030). Never indexed.
export async function generateMetadata({ params }: PageProps<"/[locale]/r/[token]">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "reviewForm" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ReviewPage({ params }: PageProps<"/[locale]/r/[token]">) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const view = await reviewLinkView(token);

  if (!view || view.expired) {
    return (
      <Card className="gap-2 p-6 text-center">
        <h1 className="text-xl font-semibold">{t("reviewForm.notFoundTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("reviewForm.notFoundBody")}</p>
      </Card>
    );
  }
  const date = fullDate(t as never, formatInTimeZone(view.startsAt, view.timeZone, "yyyy-MM-dd"));

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4 p-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-xl font-semibold">{view.business}</h1>
          <p className="text-sm text-muted-foreground">
            {[view.services, view.staff, date].filter(Boolean).join(" · ")}
          </p>
        </div>
        {view.done ? (
          <p role="status" className="text-center text-sm">
            {t("reviewForm.already")}
          </p>
        ) : (
          <ReviewForm token={token} />
        )}
      </Card>
      <Button variant="link" asChild className="self-center">
        <Link href={`/book/${view.slug}`}>{t("reviewForm.bookAgain")}</Link>
      </Button>
    </div>
  );
}
