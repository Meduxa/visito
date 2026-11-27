import { getTranslations } from "next-intl/server";
import { businessWorkbook, type Translator } from "@/features/settings/business-workbook";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

// The owner's full business export (SPEC 4.14): JSON with everything, or an
// Excel file a salon owner can read (test plan #64). Allowed even when the account is
// suspended — people must always be able to take their data with them.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const tenant = await getActiveTenant();
  if (!tenant || tenant.role !== "owner") return new Response(null, { status: 403 });
  const db = await createClient();
  const { data, error } = await db.rpc("export_tenant", { p_tenant: tenant.tenantId });
  if (error || !data) return new Response(null, { status: 500 });

  const day = new Date().toISOString().slice(0, 10);
  const name = `visito-${tenant.slug}-${day}`;
  const headers = { "Cache-Control": "private, no-store" };
  if (new URL(req.url).searchParams.get("format") !== "xlsx")
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        ...headers,
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.json"`,
      },
    });

  const url = new URL(req.url);
  const locale = ["ka", "en", "ru"].includes(url.searchParams.get("locale") ?? "")
    ? url.searchParams.get("locale")!
    : "ka";
  const all = data as Record<string, unknown>;
  const business = (all.business ?? {}) as { timezone?: string };
  const file = await businessWorkbook(all, {
    t: (await getTranslations({ locale })) as unknown as Translator,
    locale,
    timeZone: business.timezone || "Asia/Tbilisi",
  });
  return new Response(new Uint8Array(file), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
