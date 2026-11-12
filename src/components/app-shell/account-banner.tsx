import { Eye, TriangleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { leaveSupportView } from "@/features/platform/actions";
import { fullDate, fullDateTime, ymdIn } from "@/lib/date-format";
import { canManage, isReadOnly, type TenantMembership } from "@/lib/tenant";

const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

// Trial ending, payment due, read-only, deletion scheduled — one line above every page.
export async function AccountBanner({ tenant }: { tenant: TenantMembership }) {
  const t = await getTranslations();
  if (tenant.supportUntil)
    return (
      <form
        action={leaveSupportView}
        role="alert"
        className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/40 bg-accent p-3 text-sm"
      >
        <Eye className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">
          {t("supportAccess.viewing", { until: fullDateTime(t, tenant.supportUntil) })}
        </span>
        <button type="submit" className="font-medium underline">
          {t("supportAccess.leave")}
        </button>
      </form>
    );
  const manager = canManage(tenant.role);
  let text: string | null = null;
  let href: string | null = null;

  if (tenant.deletionDueAt && tenant.role === "owner") {
    text = t("account.deletion", { date: fullDate(t, ymdIn(tenant.deletionDueAt)) });
    href = "/settings/data";
  } else if (isReadOnly(tenant)) {
    text = t(`account.${tenant.status as "suspended"}`);
  } else if (tenant.status === "past_due" && manager) {
    text = t("account.pastDue");
    if (tenant.role === "owner") href = "/settings/subscription"; // pay by card (decision 031)
  } else if (tenant.status === "trial" && manager) {
    const days = daysUntil(tenant.trialEndsAt);
    if (days <= 3) text = t("account.trialEnding", { days: Math.max(0, days) });
    if (text && tenant.role === "owner") href = "/settings/subscription";
  }
  if (!text) return null;

  const body = (
    <>
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{text}</span>
    </>
  );
  const cls =
    "mb-4 flex gap-3 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm text-warning-ink";
  return href ? (
    <Link href={href} role="alert" className={`${cls} hover:underline`}>
      {body}
    </Link>
  ) : (
    <div role="alert" className={cls}>
      {body}
    </div>
  );
}
