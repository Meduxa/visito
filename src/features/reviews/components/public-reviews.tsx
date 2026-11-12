import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import type { PublicReviews } from "../queries";
import { Stars } from "./reviews-view";

// On the business's booking page (decision 030): the average and the latest
// published reviews with a comment. Clients appear by first name only.
export async function PublicReviewsBlock({ reviews }: { reviews: PublicReviews }) {
  if (reviews.count === 0 || reviews.average === null) return null;
  const t = await getTranslations("publicReviews");
  return (
    <Card className="gap-3 p-4" aria-labelledby="public-reviews">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="public-reviews" className="text-base font-semibold">
          {t("title")}
        </h2>
        <Stars value={reviews.average} />
        <span className="text-sm font-medium tabular-nums">
          {reviews.average.toFixed(1).replace(".", ",")}
        </span>
        <span className="text-sm text-muted-foreground">{t("count", { count: reviews.count })}</span>
      </div>
      {reviews.items.length > 0 && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {reviews.items.map((r, i) => (
            <li key={i} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
              <span className="flex items-center gap-2">
                <Stars value={r.rating} size="size-3.5" />
                <span className="font-medium">{r.firstName || t("client")}</span>
              </span>
              <p className="whitespace-pre-line">{r.comment}</p>
              {r.reply && (
                <p className="rounded-md bg-muted p-2 text-xs">
                  <span className="font-medium">{t("reply")}</span> {r.reply}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
