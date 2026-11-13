import { ChevronRight, MapPin } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { AddBranchCard } from "@/features/branches/components/branch-forms";
import { getBranchInfo } from "@/features/branches/queries";
import { requireSettingsAccess, sectionText } from "@/features/settings/section-page";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({ params }: PageProps<"/[locale]/settings/branches">) {
  return { title: (await sectionText((await params).locale, "branches")).title };
}

// Settings → Branches (decision 032): every branch, and adding one within the plan's limit.
export default async function BranchesPage({ params }: PageProps<"/[locale]/settings/branches">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const tenant = await requireSettingsAccess(locale);
  const t = await getTranslations("branches");
  const info = await getBranchInfo(await createClient(), tenant.tenantId);
  const activeCount = info.all.filter((b) => b.active).length;
  const canAdd = info.max === null || activeCount < info.max;
  const usable = new Set(info.usable.map((b) => b.id));

  const limitNote =
    info.max === 1
      ? t(tenant.role === "owner" ? "limit.oneOwner" : "limit.one")
      : !canAdd
        ? t("limit.reached", { max: info.max ?? 0 })
        : info.max !== null
          ? t("limit.left", { left: info.max - activeCount, max: info.max })
          : null;

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <PageHeader {...await sectionText(locale, "branches")} />
      <ul className="flex flex-col divide-y rounded-xl border bg-card" data-testid="branch-list">
        {info.all.map((b) => (
          <li key={b.id}>
            <Link
              href={`/settings/branches/${b.id}`}
              className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted/50"
            >
              <MapPin aria-hidden className="size-5 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-medium">{b.name}</span>
                <span className="truncate text-sm text-muted-foreground">{b.address || t("noAddress")}</span>
              </span>
              {b.isPrimary && <StatusPill tone="info">{t("main")}</StatusPill>}
              {!b.active && <StatusPill tone="neutral">{t("off")}</StatusPill>}
              {b.active && !usable.has(b.id) && <StatusPill tone="warning">{t("overLimit")}</StatusPill>}
              <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      {tenant.role === "owner" && info.max === 1 && (
        <Link href="/settings/subscription" className="self-start text-sm font-medium text-primary underline">
          {t("limit.upgrade")}
        </Link>
      )}
      <AddBranchCard canAdd={canAdd} limitNote={limitNote} />
    </div>
  );
}
