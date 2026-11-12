"use client";

import { FileSpreadsheet, FolderTree, Plus, Scissors, Search, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { SWATCH_BG } from "@/components/color-swatches";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailPanel } from "@/components/detail-panel";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { localized } from "@/lib/i18n-text";
import { useFormat } from "@/lib/use-format";
import { cn } from "@/lib/utils";
import { deleteService } from "../actions";
import type { Category, Service } from "../queries";
import { CategoriesPanel } from "./categories-panel";
import { ExtrasEditor } from "./extras-editor";
import { ReadyServicesCard } from "./ready-services";
import { defaultKind } from "../templates";
import { ServiceForm } from "./service-form";

const ALL = "__all";
const NONE = "__none";

export function ServicesView({
  categories,
  services,
  canManage,
  isDental,
}: {
  categories: Category[];
  services: Service[];
  canManage: boolean;
  isDental: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const fmt = useFormat();
  const [tab, setTab] = useState(ALL);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | "new" | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const catName = (c: Category) => localized(c.name, locale);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of services) m.set(s.categoryId ?? NONE, (m.get(s.categoryId ?? NONE) ?? 0) + 1);
    return m;
  }, [services]);

  const visible = services.filter((s) => {
    if (tab !== ALL && (s.categoryId ?? NONE) !== tab) return false;
    const q = query.trim().toLowerCase();
    return !q || Object.values(s.name).some((n) => n?.toLowerCase().includes(q));
  });

  const open = openId && openId !== "new" ? (services.find((s) => s.id === openId) ?? null) : null;
  const tabs = [
    { id: ALL, label: t("common.all"), count: services.length },
    ...categories.map((c) => ({ id: c.id, label: catName(c), count: counts.get(c.id) ?? 0 })),
    ...(counts.get(NONE) ? [{ id: NONE, label: t("services.uncategorized"), count: counts.get(NONE)! }] : []),
  ];

  const status = (s: Service) =>
    !s.active ? (
      <StatusPill tone="neutral">{t("services.hidden")}</StatusPill>
    ) : s.bookableOnline ? (
      <StatusPill tone="success" dot>
        {t("services.online")}
      </StatusPill>
    ) : (
      <StatusPill tone="warning" dot>
        {t("services.notOnline")}
      </StatusPill>
    );

  return (
    <>
      <PageHeader
        title={t("services.title")}
        description={t("services.subtitle")}
        actions={
          canManage && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="h-11 md:h-9" onClick={() => setCategoriesOpen(true)}>
                <FolderTree aria-hidden />
                {t("services.categories")}
              </Button>
              <Button variant="outline" className="h-11 md:h-9" asChild>
                <Link href="/services/import">
                  <FileSpreadsheet aria-hidden />
                  {t("services.import")}
                </Link>
              </Button>
              <Button className="h-11 md:h-9" onClick={() => setOpenId("new")}>
                <Plus aria-hidden />
                {t("services.new")}
              </Button>
            </div>
          )
        }
      />

      {services.length === 0 ? (
        <div className="rounded-xl border bg-card">
          <EmptyState
            icon={<Scissors />}
            title={t("services.emptyTitle")}
            description={t("services.emptyBody")}
            action={
              canManage && (
                <div className="flex flex-wrap justify-center gap-2">
                  <Button className="h-11 md:h-9" onClick={() => setOpenId("new")}>
                    {t("services.new")}
                  </Button>
                  <Button asChild variant="outline" className="h-11 md:h-9">
                    <Link href="/services/import">{t("services.import")}</Link>
                  </Button>
                </div>
              )
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Filter tabs with counts; scroll inside their own row on phones */}
          <div
            role="tablist"
            aria-label={t("services.categories")}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
          >
            {tabs.map((x) => (
              <button
                key={x.id}
                role="tab"
                aria-selected={tab === x.id}
                onClick={() => setTab(x.id)}
                className="flex min-h-9 shrink-0 items-center gap-2 rounded-lg border bg-card px-3 text-sm whitespace-nowrap text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-foreground"
              >
                {x.label}
                <span className="rounded-md bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
                  {x.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              aria-label={t("common.search")}
              placeholder={t("services.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 bg-card pl-9 md:h-9"
            />
          </div>

          {visible.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
              {t("services.noMatch")}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-card">
              <div className="hidden grid-cols-[minmax(0,1fr)_8rem_9rem_8rem] gap-4 border-b bg-muted/50 px-4 py-2.5 text-xs font-medium text-muted-foreground xl:grid">
                <span>{t("services.colName")}</span>
                <span>{t("services.colDuration")}</span>
                <span className="text-right">{t("services.colPrice")}</span>
                <span>{t("services.colStatus")}</span>
              </div>
              <ul className="divide-y">
                {visible.map((s) => {
                  const cat = categories.find((c) => c.id === s.categoryId);
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setOpenId(s.id)}
                        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-4 py-3 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset xl:grid-cols-[minmax(0,1fr)_8rem_9rem_8rem]"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <span
                            className={cn(
                              "size-2.5 shrink-0 rounded-full",
                              s.color ? SWATCH_BG[s.color] : "bg-border",
                            )}
                            aria-hidden
                          />
                          <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium break-words">
                              {localized(s.name, locale)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {cat ? catName(cat) : t("services.uncategorized")} ·{" "}
                              {t("services.staffCount", { count: s.staffCount })}
                            </span>
                          </span>
                        </span>
                        <span className="text-sm text-muted-foreground xl:order-none">
                          {fmt.duration(s.durationMin)}
                        </span>
                        <span className="col-start-1 text-sm font-medium tabular-nums xl:col-start-auto xl:text-right">
                          {fmt.price(s)}
                        </span>
                        <span className="justify-self-end xl:justify-self-start">{status(s)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* ready services, added one by one next to the business's own (decision 028) */}
      {canManage && (
        <div className="mt-4">
          <ReadyServicesCard
            existing={services.map((s) => s.name.ka ?? "").filter(Boolean)}
            initialKind={defaultKind(isDental ? "dental" : "salon")}
            defaultOpen={services.length === 0}
          />
        </div>
      )}

      {canManage && (
        <>
          <DetailPanel
            open={openId !== null}
            onOpenChange={(o) => !o && setOpenId(null)}
            title={open ? localized(open.name, locale) : t("services.new")}
            footer={
              open && (
                <ConfirmDialog
                  description={t("services.deleteConfirm", { name: localized(open.name, locale) })}
                  onConfirm={() =>
                    startTransition(async () => {
                      const r = await deleteService(open.id);
                      if (r.ok) {
                        toast.success(t("common.deleted"));
                        setOpenId(null);
                      } else toast.error(t(`errors.${r.error}`));
                    })
                  }
                  trigger={
                    <Button variant="destructive" className="h-11 md:h-9" disabled={pending}>
                      <Trash2 aria-hidden />
                      {t("common.delete")}
                    </Button>
                  }
                />
              )
            }
          >
            {openId !== null && (
              <div className="flex flex-col gap-8">
                <ServiceForm
                  key={openId}
                  service={open}
                  categories={categories}
                  categoryName={catName}
                  isDental={isDental}
                  onSaved={(id) => setOpenId(id)}
                />
                {open ? (
                  <>
                    <ExtrasEditor kind="variant" serviceId={open.id} items={open.variants} />
                    <ExtrasEditor kind="addon" serviceId={open.id} items={open.addons} />
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">{t("services.saveFirst")}</p>
                )}
              </div>
            )}
          </DetailPanel>
          <CategoriesPanel open={categoriesOpen} onOpenChange={setCategoriesOpen} categories={categories} />
        </>
      )}
    </>
  );
}
