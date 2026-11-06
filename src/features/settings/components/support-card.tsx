"use client";

import { LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "@/i18n/navigation";
import { allowSupport, endSupport } from "../support-actions";

// Owner only: let Visito support look at the business (view only) for a while.
export function SupportCard({ until }: { until: string | null }) {
  const t = useTranslations("supportAccess");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (fn: () => ReturnType<typeof endSupport>, done: string) =>
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(te(r.error as "generic"));
      toast.success(done);
      router.refresh();
    });

  return (
    <Card className="gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <LifeBuoy className="size-4" aria-hidden />
          {t("title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
      </div>
      {until ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">{t("on", { until })}</p>
          <ConfirmDialog
            description={t("endConfirm")}
            confirmLabel={t("end")}
            onConfirm={() => run(endSupport, t("ended"))}
            trigger={
              <Button variant="outline" className="h-11 self-start md:h-9" disabled={pending}>
                {t("end")}
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {[24, 72].map((h) => (
            <Button
              key={h}
              variant="outline"
              className="h-11 md:h-9"
              disabled={pending}
              onClick={() => run(() => allowSupport(h), t("allowed"))}
            >
              {t(h === 24 ? "allow24" : "allow72")}
            </Button>
          ))}
        </div>
      )}
    </Card>
  );
}
