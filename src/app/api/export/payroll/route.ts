import { getTranslations } from "next-intl/server";
import { payrollWorkbook } from "@/features/payroll/excel";
import { isMonth, loadPayroll, payrollAccess } from "@/features/payroll/payroll";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";

// Excel download of one payroll month (same access rules as the page).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) return new Response(null, { status: 403 });
  const url = new URL(req.url);
  const month = url.searchParams.get("month");
  if (!isMonth(month)) return new Response(null, { status: 400 });
  const locale = ["ka", "en", "ru"].includes(url.searchParams.get("locale") ?? "")
    ? url.searchParams.get("locale")!
    : "ka";
  const db = await createClient();
  if ((await payrollAccess(db, tenant)) !== "ok") return new Response(null, { status: 403 });
  const [payroll, t] = await Promise.all([
    loadPayroll(db, tenant.tenantId, month, locale),
    getTranslations({ locale }),
  ]);
  const file = await payrollWorkbook(payroll, { t: t as never, month });
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="visito-payroll-${month}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
