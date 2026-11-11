import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import writeXlsxFile from "write-excel-file/node";
import { COLUMNS_COOKIE, parseColumns, visibleColumns } from "@/features/clients/fields";
import { listClientFields, listClientsForExport } from "@/features/clients/queries";
import { clientListParams } from "@/features/clients/schema";
import { canSeeMoney } from "@/features/reports/report";
import { ymdIn } from "@/lib/date-format";
import { excelSafe } from "@/lib/excel-safe";
import { createClient } from "@/lib/supabase/server";
import { canManage, getActiveTenant } from "@/lib/tenant";
import { DEFAULT_TZ } from "@/lib/time";

// Excel of the client list exactly as it is filtered and sorted on screen
// (decision 026): every page, the chosen columns. Owner/admin only — it is
// personal data, so every download is written to the audit log.
export const dynamic = "force-dynamic";

type Cell = {
  value: string | number | null;
  fontWeight?: "bold";
  type?: NumberConstructor | StringConstructor;
  format?: string;
} | null;

export async function GET(req: Request) {
  const tenant = await getActiveTenant();
  if (!tenant || !canManage(tenant.role)) return new Response(null, { status: 403 });
  const url = new URL(req.url);
  const locale = ["ka", "en", "ru"].includes(url.searchParams.get("locale") ?? "")
    ? url.searchParams.get("locale")!
    : "ka";
  const view = clientListParams.parse(Object.fromEntries(url.searchParams));
  const db = await createClient();
  const { data: tz } = await db.from("tenants").select("timezone").eq("id", tenant.tenantId).single();
  const timeZone = tz?.timezone ?? DEFAULT_TZ;
  const money = await canSeeMoney(db, tenant.tenantId, tenant.role);
  if (view.sort === "spent" && !money) view.sort = "added";

  const [rows, fields, t] = await Promise.all([
    listClientsForExport(tenant.tenantId, view, { timeZone }),
    listClientFields(tenant.tenantId),
    getTranslations({ locale }),
  ]);
  const columns = visibleColumns(
    parseColumns((await cookies()).get(COLUMNS_COOKIE)?.value, fields),
    money,
  ).filter((c) => c !== "phone"); // name, phone and email always come first
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const text = (s: string | null | undefined): Cell => ({ value: s ? excelSafe(s) : null, type: String });
  const num = (n: number | null): Cell => ({ value: n, type: Number });
  const gel = (minor: number | null): Cell =>
    minor === null ? null : { value: minor / 100, type: Number, format: "#,##0.00" };
  const day = (iso: string | null) => text(iso ? ymdIn(iso, timeZone) : null);
  const label = (c: string) =>
    c.startsWith("f:")
      ? (fieldById.get(c.slice(2))?.label ?? "")
      : t(`clients.col${c[0].toUpperCase()}${c.slice(1)}` as "clients.colPhone");

  const header: Cell[] = [
    t("clients.fields.firstName"),
    t("clients.fields.lastName"),
    t("clients.fields.phone"),
    t("clients.fields.email"),
    ...columns.map(label),
    t("clients.fields.tags"),
  ].map((value) => ({ value, fontWeight: "bold" }));

  const body = rows.map((c): Cell[] => [
    text(c.firstName),
    text(c.lastName),
    text(c.phone),
    text(c.email),
    ...columns.map((col): Cell => {
      switch (col) {
        case "group":
          return text(t(`clients.segments.${c.segment}`));
        case "lastVisit":
          return day(c.lastVisitAt);
        case "nextVisit":
          return day(c.nextVisitAt);
        case "visits":
          return num(c.visits);
        case "spent":
          return gel(c.spentMinor);
        case "average":
          return gel(c.averageMinor);
        default: {
          const v = c.custom[col.slice(2)];
          if (v === undefined) return null;
          if (typeof v === "boolean") return text(v ? t("clients.ownFields.yes") : t("clients.ownFields.no"));
          return typeof v === "number" ? num(v) : text(v);
        }
      }
    }),
    text(c.tags.join(", ")),
  ]);

  const file = (await writeXlsxFile([header, ...body], { buffer: true } as never)) as unknown as Buffer;
  await db.rpc("log_audit", {
    p_tenant: tenant.tenantId,
    p_action: "clients.list_exported",
    p_entity: "client",
    p_meta: {
      rows: rows.length,
      segment: view.segment ?? null,
      tag: view.tag ?? null,
      search: view.q ? true : false,
      filters: (["upcoming", "birthday", "noshow"] as const).filter((k) => !!view[k]),
    },
  });
  const stamp = ymdIn(new Date().toISOString(), timeZone);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="visito-clients-${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
