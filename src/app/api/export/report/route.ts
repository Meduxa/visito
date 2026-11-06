import { getTranslations } from "next-intl/server";
import { reportWorkbook } from "@/features/reports/excel";
import { reportParams } from "@/features/reports/params";
import { buildReport, canSeeMoney } from "@/features/reports/report";
import { ymdIn } from "@/lib/date-format";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";

// Excel download of the report page (same filters, same access rules).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) return new Response(null, { status: 403 });
  const url = new URL(req.url);
  const locale = ["ka", "en", "ru"].includes(url.searchParams.get("locale") ?? "")
    ? url.searchParams.get("locale")!
    : "ka";
  const db = await createClient();
  const { from, to, staff } = reportParams(
    Object.fromEntries(url.searchParams),
    ymdIn(new Date().toISOString()),
  );
  const [report, money, t] = await Promise.all([
    buildReport(db, tenant.tenantId, { from, to, staffId: staff, locale }),
    canSeeMoney(db, tenant.tenantId, tenant.role),
    getTranslations({ locale }),
  ]);
  const file = await reportWorkbook(report, { t: t as never, money, from, to });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="visito-report-${from}-${to}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
