import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { Link } from "@/i18n/navigation";
import { getSmsProvider } from "@/integrations/sms";
import { fullDateTime } from "@/lib/date-format";
import { formatMoney } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const FILTERS = ["all", "failed", "queued", "skipped"] as const;

// All businesses' SMS (newest 200), to spot provider problems and error rates.
export default async function AdminSmsPage({ params, searchParams }: PageProps<"/[locale]/admin/sms">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  const sp = await searchParams;
  const status = (FILTERS as readonly string[]).includes(String(sp.status)) ? String(sp.status) : "all";
  const { data } = await (
    await createClient()
  ).rpc("admin_sms_log", {
    p_status: (status === "all" ? null : status) as string,
    p_limit: 200,
  });
  const rows = (data ?? []) as {
    id: string;
    tenant: string;
    created_at: string;
    to_phone: string;
    type: string;
    status: string;
    segments: number;
    error_code: string | null;
  }[];
  const failed = rows.filter((r) => r.status === "failed").length;
  // Visito's own account with the SMS company (top it up before it runs out)
  const provider = (() => {
    try {
      return getSmsProvider();
    } catch {
      return null;
    }
  })();
  const balance = (await provider?.getBalance?.()) ?? null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t("platform.nav.sms")}
        description={status === "all" ? t("platform.errorRate", { failed, total: rows.length }) : undefined}
      />
      <p className="text-sm text-muted-foreground">
        {!provider || provider.name === "fake"
          ? t("platform.smsProvider.none")
          : balance
            ? t("platform.smsProvider.balance", {
                provider: provider.name,
                amount: formatMoney(balance.balanceMinor, `${locale}-GE`),
              })
            : t("platform.smsProvider.unknown", { provider: provider.name })}
      </p>
      <nav
        className="flex flex-wrap gap-1 self-start rounded-lg bg-muted p-1"
        aria-label={t("platform.nav.sms")}
      >
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/sms" : `/admin/sms?status=${f}`}
            aria-current={f === status ? "page" : undefined}
            className={cn(
              "flex min-h-9 items-center rounded-md px-3 text-sm",
              f === status ? "bg-card font-medium shadow-sm" : "text-muted-foreground",
            )}
          >
            {t(`platform.smsFilters.${f}`)}
          </Link>
        ))}
      </nav>
      <div
        tabIndex={0}
        role="region"
        aria-label={t("platform.nav.sms")}
        className="overflow-x-auto rounded-xl border bg-card focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <table className="w-full min-w-[720px] text-sm">
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="p-3 text-muted-foreground">{fullDateTime(t, r.created_at)}</td>
                <td className="p-3">{r.tenant}</td>
                <td className="p-3 tabular-nums">{r.to_phone}</td>
                <td className="p-3">{t(`smsLog.types.${r.type as "reminder"}`)}</td>
                <td className="p-3">{t(`smsLog.status.${r.status as "sent"}`)}</td>
                <td className="p-3 text-right tabular-nums">{r.segments}</td>
                <td className="p-3 text-destructive">{r.error_code ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
