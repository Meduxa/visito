import writeXlsxFile from "write-excel-file/node";
import { excelSafe } from "@/lib/excel-safe";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenant } from "@/lib/tenant";

// The owner's full business export (SPEC 4.14): JSON with everything, or an
// Excel file with one sheet per table. Allowed even when the account is
// suspended — people must always be able to take their data with them.
export const dynamic = "force-dynamic";

const SHEETS = ["services", "staff", "clients", "consents", "bookings", "payments", "sms_messages"] as const;

const cell = (v: unknown) =>
  v === null || v === undefined
    ? null
    : typeof v === "number"
      ? { value: v, type: Number }
      : { value: excelSafe(typeof v === "object" ? JSON.stringify(v) : String(v)), type: String };

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

  const all = data as Record<string, Record<string, unknown>[]>;
  const sheets = SHEETS.map((key) => {
    const rows = all[key] ?? [];
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    return [
      cols.map((c) => ({ value: c, fontWeight: "bold" as const })),
      ...rows.map((r) => cols.map((c) => cell(r[c]))),
    ];
  });
  const file = (await writeXlsxFile(sheets, {
    sheets: [...SHEETS],
    buffer: true,
  } as never)) as unknown as Buffer;
  return new Response(new Uint8Array(file), {
    headers: {
      ...headers,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}.xlsx"`,
    },
  });
}
