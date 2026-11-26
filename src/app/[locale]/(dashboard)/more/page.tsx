import { getTranslations, setRequestLocale } from "next-intl/server";
import { MoreNavList } from "@/components/app-shell/nav";
import { PageHeader } from "@/components/page-header";
import { InstallApp } from "@/components/pwa";
import { ThemeToggle } from "@/components/theme-toggle";
import { canSeeMoney } from "@/features/reports/report";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";

// the browser tab says which page this is (test plan #51)
export async function generateMetadata({ params }: PageProps<"/[locale]/more">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "nav" });
  return { title: t("more") };
}

export default async function MorePage({ params }: PageProps<"/[locale]/more">) {
  setRequestLocale((await params).locale);
  const [t, tenant, db] = await Promise.all([getTranslations("nav"), getActiveTenant(), createClient()]);
  const manager = !!tenant && canManage(tenant.role);
  const [seeMoney, { count }] = tenant
    ? await Promise.all([
        canSeeMoney(db, tenant.tenantId, tenant.role),
        manager
          ? db
              .from("time_off_requests")
              .select("id", { count: "exact", head: true })
              .eq("tenant_id", tenant.tenantId)
              .eq("status", "pending")
          : Promise.resolve({ count: 0 }),
      ])
    : [false, { count: 0 }];
  return (
    <div className="flex max-w-xl flex-col gap-4">
      <PageHeader title={t("more")} />
      <MoreNavList canManage={manager} seeMoney={seeMoney} badges={{ staff: count ?? 0 }} />
      <div className="rounded-xl border bg-card py-1">
        <InstallApp />
        <ThemeToggle />
      </div>
    </div>
  );
}
