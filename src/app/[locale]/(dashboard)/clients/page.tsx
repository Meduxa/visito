import { cookies } from "next/headers";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClientsView } from "@/features/clients/components/clients-view";
import { COLUMNS_COOKIE, parseColumns, visibleColumns } from "@/features/clients/fields";
import { getSegmentRules, listClientFields, listClients, listClientTags } from "@/features/clients/queries";
import { clientListParams } from "@/features/clients/schema";
import { canSeeMoney } from "@/features/reports/report";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { DEFAULT_TZ } from "@/lib/time";

export async function generateMetadata({ params }: PageProps<"/[locale]/clients">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "clients" });
  return { title: t("title") };
}

export default async function ClientsPage({ params, searchParams }: PageProps<"/[locale]/clients">) {
  setRequestLocale((await params).locale);
  const tenant = await getActiveTenant();
  if (!tenant) return null;
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const view = clientListParams.parse(Object.fromEntries(Object.keys(sp).map((k) => [k, one(sp[k])])));

  const supabase = await createClient();
  const { data: tz } = await supabase.from("tenants").select("timezone").eq("id", tenant.tenantId).single();
  const timeZone = tz?.timezone ?? DEFAULT_TZ;
  const money = await canSeeMoney(supabase, tenant.tenantId, tenant.role);
  // sorting by money is only for people who may see it
  if (view.sort === "spent" && !money) view.sort = "added";
  const [{ clients, total, segmentCounts }, tags, { data: staff }, fields, rules] = await Promise.all([
    listClients(tenant.tenantId, view, { timeZone }),
    listClientTags(tenant.tenantId),
    supabase
      .from("staff")
      .select("id, display_name")
      .eq("tenant_id", tenant.tenantId)
      .eq("active", true)
      .order("display_name"),
    listClientFields(tenant.tenantId),
    getSegmentRules(tenant.tenantId),
  ]);
  // the desktop table's columns, as chosen in this browser (decision 026)
  const columns = visibleColumns(parseColumns((await cookies()).get(COLUMNS_COOKIE)?.value, fields), money);

  return (
    <ClientsView
      clients={clients}
      total={total}
      segmentCounts={segmentCounts}
      view={view}
      tags={tags}
      staff={(staff ?? []).map((s) => ({ id: s.id, name: s.display_name }))}
      canManage={canManage(tenant.role)}
      canSeeMoney={money}
      isOwner={tenant.role === "owner"}
      isDental={tenant.type === "dental"}
      timeZone={timeZone}
      fields={fields}
      columns={columns}
      rules={rules}
    />
  );
}
