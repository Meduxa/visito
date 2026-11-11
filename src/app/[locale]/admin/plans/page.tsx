import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { PlanEditor } from "@/features/platform/components/tenant-admin-forms";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPlansPage({ params }: PageProps<"/[locale]/admin/plans">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("platform");
  const { data } = await (await createClient()).from("plans").select("*").order("sort_order").order("code");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("nav.plans")} description={t("plans.hint")} />
      {(data ?? []).map((p) => (
        <PlanEditor
          key={p.code}
          plan={{
            code: p.code,
            name: p.name,
            price: (p.price_minor / 100).toString(),
            maxStaff: p.max_staff === null ? "" : String(p.max_staff),
            smsPerMonth: String(p.sms_per_month),
            active: p.active,
            features: p.features.filter((f): f is "payroll" => f === "payroll"),
          }}
        />
      ))}
      <h2 className="pt-2 text-base font-semibold">{t("plans.new")}</h2>
      <PlanEditor
        isNew
        plan={{ code: "", name: "", price: "", maxStaff: "", smsPerMonth: "0", active: true, features: [] }}
      />
    </div>
  );
}
