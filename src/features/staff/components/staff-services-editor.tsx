"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { localized, type I18nText } from "@/lib/i18n-text";
import { useFormat, type PriceShape } from "@/lib/use-format";
import { saveStaffServices } from "../actions";

type CatalogService = PriceShape & { id: string; name: I18nText; durationMin: number; categoryName: string };
type Pick = { checked: boolean; price: string; duration: string };

export function StaffServicesEditor({
  staffId,
  catalog,
  selected,
}: {
  staffId: string;
  catalog: CatalogService[];
  selected: { serviceId: string; priceMinorOverride: number | null; durationMinOverride: number | null }[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmt = useFormat();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [picks, setPicks] = useState<Record<string, Pick>>(() => {
    const m: Record<string, Pick> = {};
    for (const s of catalog) {
      const sel = selected.find((x) => x.serviceId === s.id);
      m[s.id] = {
        checked: !!sel,
        price: sel?.priceMinorOverride != null ? String(sel.priceMinorOverride / 100).replace(".", ",") : "",
        duration: sel?.durationMinOverride != null ? String(sel.durationMinOverride) : "",
      };
    }
    return m;
  });

  if (catalog.length === 0) {
    return (
      <EmptyState
        title={t("staff.services.emptyCatalog")}
        action={
          <Button asChild className="h-11 md:h-9">
            <Link href="/services">{t("services.title")}</Link>
          </Button>
        }
      />
    );
  }

  const update = (id: string, patch: Partial<Pick>) =>
    setPicks((p) => ({ ...p, [id]: { ...p[id], ...patch } }));
  const count = Object.values(picks).filter((p) => p.checked).length;
  const groups = [...new Set(catalog.map((s) => s.categoryName))];

  const save = () =>
    startTransition(async () => {
      setError(undefined);
      const rows = Object.entries(picks)
        .filter(([, p]) => p.checked)
        .map(([serviceId, p]) => ({ serviceId, price: p.price, duration: p.duration }));
      const r = await saveStaffServices(staffId, rows);
      if (!r.ok) return setError(r.error);
      toast.success(t("common.saved"));
    });

  return (
    <section className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("staff.services.hint")}</p>
      {groups.map((g) => (
        <div key={g} className="overflow-hidden rounded-xl border bg-card">
          <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
            <span>{g}</span>
            <button
              type="button"
              className="rounded px-1 text-primary underline-offset-2 hover:underline"
              onClick={() => {
                const ids = catalog.filter((s) => s.categoryName === g).map((s) => s.id);
                const all = ids.every((id) => picks[id].checked);
                ids.forEach((id) => update(id, { checked: !all }));
              }}
            >
              {t("common.all")}
            </button>
          </div>
          <ul className="divide-y">
            {catalog
              .filter((s) => s.categoryName === g)
              .map((s) => {
                const p = picks[s.id];
                const name = localized(s.name, locale);
                return (
                  <li
                    key={s.id}
                    className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_7rem_7rem]"
                  >
                    <Checkbox
                      id={`svc-${s.id}`}
                      checked={p.checked}
                      onCheckedChange={(v) => update(s.id, { checked: v === true })}
                    />
                    <label htmlFor={`svc-${s.id}`} className="flex min-w-0 cursor-pointer flex-col">
                      <span className="text-sm break-words">{name}</span>
                      <span className="text-xs text-muted-foreground">
                        {fmt.price(s)} · {fmt.duration(s.durationMin)}
                      </span>
                    </label>
                    {p.checked && (
                      <>
                        <Input
                          inputMode="decimal"
                          value={p.price}
                          placeholder={t("staff.services.ownPriceShort")}
                          aria-label={`${name}: ${t("staff.services.ownPrice")}`}
                          onChange={(e) => update(s.id, { price: e.target.value })}
                          className="col-start-2 h-10 sm:col-start-auto md:h-8"
                        />
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={5}
                          step={5}
                          value={p.duration}
                          placeholder={t("staff.services.ownDurationShort")}
                          aria-label={`${name}: ${t("staff.services.ownDuration")}`}
                          onChange={(e) => update(s.id, { duration: e.target.value })}
                          className="col-start-2 h-10 sm:col-start-auto md:h-8"
                        />
                      </>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
      <FieldError code={error} />
      <div className="flex flex-wrap items-center gap-3">
        <Button className="h-11 md:h-9" disabled={pending} onClick={save}>
          {t("common.save")}
        </Button>
        <span className="text-sm text-muted-foreground">{t("staff.services.selected", { count })}</span>
      </div>
    </section>
  );
}
