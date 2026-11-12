"use client";

import { Eye, EyeOff, MessageSquareReply, Star } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { FieldError } from "@/components/field-error";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Link, useRouter } from "@/i18n/navigation";
import { useDates } from "@/lib/use-dates";
import { cn } from "@/lib/utils";
import { moderateReview } from "../actions";
import type { ReviewRow } from "../queries";

export function Stars({ value, size = "size-4" }: { value: number; size?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} / 5`} role="img">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            size,
            i <= Math.round(value) ? "fill-warning text-warning" : "text-muted-foreground/40",
          )}
        />
      ))}
    </span>
  );
}

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

export function ReviewsView({
  rows,
  average,
  byStars,
  canManage,
  asking,
}: {
  rows: ReviewRow[];
  average: number | null;
  byStars: { stars: number; count: number }[];
  canManage: boolean;
  asking: boolean;
}) {
  const t = useTranslations("reviews");
  const [filter, setFilter] = useState<"all" | "low" | "hidden">("all");
  const shown = rows.filter((r) =>
    filter === "low" ? r.rating <= 3 : filter === "hidden" ? r.status === "hidden" : true,
  );
  const max = Math.max(1, ...byStars.map((b) => b.count));

  return (
    <div className="flex flex-col gap-4">
      {!asking && canManage && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {t("notAsking")}{" "}
          <Link href="/settings/reviews" className="font-medium text-foreground underline">
            {t("turnOn")}
          </Link>
        </p>
      )}
      {rows.length === 0 ? (
        <EmptyState icon={<Star />} title={t("emptyTitle")} description={t("emptyBody")} />
      ) : (
        <>
          <Card className="grid gap-4 p-4 sm:grid-cols-[auto_1fr]">
            <div className="flex flex-col items-center justify-center gap-1 sm:px-6">
              <span className="text-4xl font-bold tabular-nums">{average === null ? "—" : fmt(average)}</span>
              <Stars value={average ?? 0} />
              <span className="text-xs text-muted-foreground">{t("count", { count: rows.length })}</span>
            </div>
            <ul className="flex flex-col gap-1.5 text-sm" aria-label={t("distribution")}>
              {byStars.map((b) => (
                <li key={b.stars} className="grid grid-cols-[2rem_1fr_2rem] items-center gap-2">
                  <span className="tabular-nums">{b.stars} ★</span>
                  <span className="h-2 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-warning"
                      style={{ width: `${(b.count / max) * 100}%` }}
                    />
                  </span>
                  <span className="text-right text-muted-foreground tabular-nums">{b.count}</span>
                </li>
              ))}
            </ul>
          </Card>
          <div role="tablist" aria-label={t("filter")} className="flex gap-2">
            {(["all", "low", "hidden"] as const).map((f) => (
              <Button
                key={f}
                role="tab"
                aria-selected={filter === f}
                variant="outline"
                size="sm"
                onClick={() => setFilter(f)}
                className={cn(
                  "h-11 rounded-full md:h-8",
                  filter === f && "border-primary bg-accent text-accent-foreground",
                )}
              >
                {t(`filters.${f}`)}
              </Button>
            ))}
          </div>
          <ul className="flex flex-col gap-3">
            {shown.map((r) => (
              <ReviewItem key={r.id} r={r} canManage={canManage} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function ReviewItem({ r, canManage }: { r: ReviewRow; canManage: boolean }) {
  const t = useTranslations("reviews");
  const { dayShort } = useDates();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply ?? "");
  const [error, setError] = useState<string>();
  const save = (status: "published" | "hidden", text: string) =>
    start(async () => {
      setError(undefined);
      const res = await moderateReview(r.id, { status, reply: text });
      if (!res.ok) return setError(res.error);
      toast.success(t("saved"));
      setReplying(false);
      router.refresh();
    });
  return (
    <li>
      <Card className={cn("gap-2 p-4", r.status === "hidden" && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-2">
          <Stars value={r.rating} />
          <span className="text-sm font-medium">{r.client ?? t("anonymous")}</span>
          {r.status === "hidden" && <StatusPill tone="neutral">{t("hidden")}</StatusPill>}
          <span className="ml-auto text-xs text-muted-foreground">{dayShort(r.createdAt.slice(0, 10))}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          {[r.services, r.staff].filter(Boolean).join(" · ")}
          {r.visitAt && ` · ${t("visit", { date: dayShort(r.visitAt.slice(0, 10)) })}`}
        </p>
        {r.comment ? (
          <p className="text-sm whitespace-pre-line">{r.comment}</p>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noComment")}</p>
        )}
        {r.reply && !replying && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="block text-xs font-medium text-muted-foreground">{t("yourReply")}</span>
            {r.reply}
          </div>
        )}
        {replying && (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save(r.status, reply);
            }}
          >
            <label htmlFor={`reply-${r.id}`} className="text-sm font-medium">
              {t("yourReply")}
            </label>
            <Textarea
              id={`reply-${r.id}`}
              rows={3}
              maxLength={1000}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              autoFocus
            />
            <div className="flex gap-2">
              <Button type="submit" className="h-11 md:h-8" disabled={pending}>
                {t("send")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-11 md:h-8"
                onClick={() => setReplying(false)}
              >
                {t("cancel")}
              </Button>
            </div>
          </form>
        )}
        <FieldError code={error} />
        {canManage && !replying && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-11 md:h-8" onClick={() => setReplying(true)}>
              <MessageSquareReply aria-hidden />
              {r.reply ? t("editReply") : t("reply")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-11 md:h-8"
              disabled={pending}
              onClick={() => save(r.status === "hidden" ? "published" : "hidden", r.reply ?? "")}
            >
              {r.status === "hidden" ? <Eye aria-hidden /> : <EyeOff aria-hidden />}
              {r.status === "hidden" ? t("show") : t("hide")}
            </Button>
          </div>
        )}
      </Card>
    </li>
  );
}
