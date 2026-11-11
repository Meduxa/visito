import { BadgeCheck, EyeOff, Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";

// The plan does not include payroll: show what it does and how to get it.
export async function PayrollLocked({ plans }: { plans: string[] }) {
  const t = await getTranslations("payroll");
  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <PageHeader title={t("title")} />
      <Card className="gap-4 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-accent p-2.5 text-accent-foreground">
            <Lock className="size-5" aria-hidden />
          </div>
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">{t("locked.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {plans.length ? t("locked.plans", { plans: plans.join(", ") }) : t("locked.noPlans")}
            </p>
          </div>
        </div>
        <ul className="flex flex-col gap-2 text-sm">
          {(["schemes", "rates", "extras", "payouts", "excel"] as const).map((k) => (
            <li key={k} className="flex gap-2">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              {t(`locked.points.${k}`)}
            </li>
          ))}
        </ul>
        <p className="text-sm font-medium">{t("locked.contact")}</p>
      </Card>
    </div>
  );
}

export async function PayrollHidden() {
  const t = await getTranslations("payroll");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={<EyeOff />} title={t("hidden")} />
    </>
  );
}
