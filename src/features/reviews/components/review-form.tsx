"use client";

import { Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitReview } from "../actions";

// The client's side of a review link (decision 030): 1–5 stars and a comment.
export function ReviewForm({ token }: { token: string }) {
  const t = useTranslations("reviewForm");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();

  if (sent)
    return (
      <div role="status" className="flex flex-col items-center gap-2 py-4 text-center">
        <p className="text-lg font-semibold">{t("thanks")}</p>
        <p className="text-sm text-muted-foreground">{t("thanksBody")}</p>
      </div>
    );

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating) return setError("chooseRating");
        start(async () => {
          setError(undefined);
          const r = await submitReview(token, { rating, comment });
          if (!r.ok) return setError(r.error);
          setSent(true);
        });
      }}
    >
      <fieldset className="flex flex-col items-center gap-2">
        <legend className="mb-2 text-center text-sm font-medium">{t("question")}</legend>
        <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <label key={i} className="cursor-pointer" onMouseEnter={() => setHover(i)}>
              <input
                type="radio"
                name="rating"
                value={i}
                checked={rating === i}
                onChange={() => setRating(i)}
                className="peer sr-only"
                aria-label={t("stars", { count: i })}
              />
              <Star
                aria-hidden
                className={cn(
                  "size-10 rounded-md transition-colors peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                  i <= (hover || rating) ? "fill-warning text-warning" : "text-muted-foreground/40",
                )}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <label htmlFor="review-comment" className="text-sm font-medium">
          {t("comment")}
        </label>
        <Textarea
          id="review-comment"
          rows={4}
          maxLength={1000}
          placeholder={t("commentPlaceholder")}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">{t("publicNote")}</p>
      </div>
      <FieldError code={error} />
      <Button type="submit" className="h-12" disabled={pending}>
        {t("send")}
      </Button>
    </form>
  );
}
