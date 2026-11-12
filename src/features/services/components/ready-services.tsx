"use client";

import { Check, ChevronDown, LayoutTemplate, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "@/i18n/navigation";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { addTemplateServices } from "../actions";
import {
  businessKinds,
  TEMPLATES,
  type BusinessKind,
  type T3,
  type TemplateCategory,
  type TemplateService,
} from "../templates";

// Ready services (decision 028, hybrid since 2026-11-12): visible on the Services
// page next to the business's own list and added one by one by choice; the
// manual "New service" form stays, and can start from a ready service.

const row = (c: TemplateCategory, s: TemplateService) => ({
  category: c.name,
  name: s.name,
  price_minor: s.gel * 100,
  price_type: s.from ? ("from" as const) : ("fixed" as const),
  duration_min: s.min,
});

export function ReadyServicesCard({
  existing,
  initialKind,
  defaultOpen,
}: {
  /** Georgian names of the business's services (added ones are marked) */
  existing: string[];
  initialKind: BusinessKind;
  defaultOpen: boolean;
}) {
  const t = useTranslations("serviceTemplates");
  const locale = useLocale() as keyof T3;
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [kind, setKind] = useState<BusinessKind>(initialKind);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const have = new Set(existing.map((n) => n.toLowerCase()));

  const add = (c: TemplateCategory, s: TemplateService) =>
    start(async () => {
      setBusy(s.name.ka);
      const r = await addTemplateServices([row(c, s)]);
      setBusy(null);
      if (!r.ok) {
        toast.error(t("failed"));
        return;
      }
      toast.success(t("addedOne", { name: s.name[locale] }));
      router.refresh();
    });

  return (
    <Card className="gap-0 p-0" aria-labelledby="ready-services">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="ready-services-list"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <LayoutTemplate className="size-4 text-primary" aria-hidden />
        <span className="flex flex-1 flex-col">
          <span id="ready-services" className="text-sm font-semibold">
            {t("button")}
          </span>
          <span className="text-xs text-muted-foreground">{t("cardHint")}</span>
        </span>
        <ChevronDown
          className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open && (
        <div id="ready-services-list" className="flex flex-col gap-3 border-t px-4 py-3">
          <div
            role="radiogroup"
            aria-label={t("kind")}
            className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {businessKinds.map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={cn(
                  "h-11 shrink-0 rounded-full border bg-card px-3 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8",
                  kind === k && "border-primary bg-accent font-medium text-accent-foreground hover:bg-accent",
                )}
              >
                {t(`kinds.${k}`)}
              </button>
            ))}
          </div>
          {TEMPLATES[kind].map((c) => (
            <div key={c.name.ka} className="flex flex-col">
              <h3 className="py-1 text-xs font-semibold text-muted-foreground uppercase">{c.name[locale]}</h3>
              <ul className="divide-y rounded-lg border">
                {c.services.map((s) => {
                  const added = have.has(s.name.ka.toLowerCase());
                  return (
                    <li key={s.name.ka} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        {s.name[locale]}
                        <span className="block text-xs text-muted-foreground">
                          {t("durationPrice", {
                            min: s.min,
                            price: s.from
                              ? t("fromPrice", { price: formatMoney(s.gel * 100) })
                              : formatMoney(s.gel * 100),
                          })}
                        </span>
                      </span>
                      {added ? (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Check className="size-3.5" aria-hidden />
                          {t("exists")}
                        </span>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-11 md:h-8"
                          disabled={busy !== null}
                          aria-label={t("addOneLabel", { name: s.name[locale] })}
                          onClick={() => add(c, s)}
                        >
                          <Plus aria-hidden />
                          {busy === s.name.ka ? t("adding") : t("addOne")}
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">{t("hint")}</p>
        </div>
      )}
    </Card>
  );
}

/** In the "New service" form: pick a ready service to fill the fields, then edit freely. */
export function ReadyServicePicker({
  initialKind,
  onPick,
}: {
  initialKind: BusinessKind;
  onPick: (c: TemplateCategory, s: TemplateService) => void;
}) {
  const t = useTranslations("serviceTemplates");
  const locale = useLocale() as keyof T3;
  const kinds = [initialKind, ...businessKinds.filter((k) => k !== initialKind)];
  const items = kinds.flatMap((k) =>
    TEMPLATES[k].flatMap((c, ci) => c.services.map((s, si) => ({ key: `${k}:${ci}:${si}`, k, c, s }))),
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
      <label htmlFor="ready-pick" className="text-sm font-medium">
        {t("fromReady")}
      </label>
      <Select
        value=""
        onValueChange={(key) => {
          const it = items.find((x) => x.key === key);
          if (it) onPick(it.c, it.s);
        }}
      >
        <SelectTrigger id="ready-pick" className="h-11 w-full md:h-9">
          <SelectValue placeholder={t("fromReadyPlaceholder")} />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {kinds.map((k) => (
            <SelectGroup key={k}>
              <SelectLabel>{t(`kinds.${k}`)}</SelectLabel>
              {items
                .filter((x) => x.k === k)
                .map((x) => (
                  <SelectItem key={x.key} value={x.key}>
                    {x.s.name[locale]}
                  </SelectItem>
                ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t("fromReadyHint")}</p>
    </div>
  );
}
