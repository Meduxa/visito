"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { ColorSwatches } from "@/components/color-swatches";
import { FieldError } from "@/components/field-error";
import { describedBy, FormField, SwitchRow } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveService } from "../actions";
import type { Category, Service } from "../queries";
import { priceTypes, resourceTypes, serviceSchema, type ServiceInput } from "../schema";
import { defaultKind } from "../templates";
import { ReadyServicePicker } from "./ready-services";

const LANGS = ["ka", "en", "ru"] as const;
const NONE = "__none";

const toText = (minor: number | null) =>
  minor === null ? "" : minor % 100 === 0 ? String(minor / 100) : (minor / 100).toFixed(2).replace(".", ",");

export function ServiceForm({
  service,
  categories,
  categoryName,
  isDental,
  onSaved,
}: {
  service: Service | null;
  categories: Category[];
  categoryName: (c: Category) => string;
  isDental: boolean;
  onSaved: (id: string) => void;
}) {
  const t = useTranslations();
  const locale = useLocale() as (typeof LANGS)[number];
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const form = useForm<ServiceInput>({
    resolver: zodResolver(serviceSchema) as never,
    defaultValues: {
      name: { ka: service?.name.ka ?? "", en: service?.name.en ?? "", ru: service?.name.ru ?? "" },
      description: {
        ka: service?.description.ka ?? "",
        en: service?.description.en ?? "",
        ru: service?.description.ru ?? "",
      },
      categoryId: service?.categoryId ?? null,
      priceType: service?.priceType ?? "fixed",
      price: toText(service?.priceMinor ?? null),
      priceMax: toText(service?.priceMaxMinor ?? null),
      durationMin: service?.durationMin ?? 60,
      bufferAfterMin: service?.bufferAfterMin ?? 0,
      active: service?.active ?? true,
      bookableOnline: service?.bookableOnline ?? true,
      color: service?.color ?? null,
      resourceType: service?.resourceType ?? null,
    } as ServiceInput,
  });
  const { errors } = form.formState;
  const priceType = useWatch({ control: form.control, name: "priceType" });

  const onSubmit = form.handleSubmit(() => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await saveService(service?.id ?? null, form.getValues());
      if (!result.ok) return setFormError(result.error);
      toast.success(t("common.saved"));
      onSaved(result.data.id);
    });
  });

  const nameError = (errors.name as { message?: string } | undefined)?.message ?? errors.name?.root?.message;

  return (
    <form id="service-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {!service && (
        <ReadyServicePicker
          initialKind={defaultKind(isDental ? "dental" : "salon")}
          onPick={(c, s) => {
            // fills the form; everything stays editable before saving
            const cat = categories.find((x) => (x.name.ka ?? "").toLowerCase() === c.name.ka.toLowerCase());
            form.setValue("name", { ...s.name });
            form.setValue("durationMin", s.min);
            form.setValue("price", String(s.gel));
            form.setValue("priceType", s.from ? "from" : "fixed");
            if (cat) form.setValue("categoryId", cat.id);
          }}
        />
      )}
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("services.fields.name")}</legend>
        {LANGS.map((l) => (
          <div key={l} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-muted-foreground" id={`name-${l}-label`}>
              {t(`languages.${l}`)}
            </span>
            <Input
              lang={l}
              aria-labelledby={`name-${l}-label`}
              className="h-11 md:h-9"
              aria-invalid={!!nameError}
              {...form.register(`name.${l}`)}
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">{t("services.fields.nameHint")}</p>
        <FieldError code={nameError} />
      </fieldset>

      <FormField id="categoryId" label={t("services.fields.category")}>
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value ?? NONE} onValueChange={(v) => field.onChange(v === NONE ? null : v)}>
              <SelectTrigger id="categoryId" className="h-11 w-full md:h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{t("services.fields.noCategory")}</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {categoryName(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FormField>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{t("services.fields.priceType")}</legend>
        <Controller
          control={form.control}
          name="priceType"
          render={({ field }) => (
            <div role="radiogroup" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
              {priceTypes.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={field.value === p}
                  onClick={() => field.onChange(p)}
                  className="min-h-9 rounded-md px-2 text-sm text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-checked:bg-card aria-checked:font-medium aria-checked:text-foreground aria-checked:shadow-sm"
                >
                  {t(`services.priceTypes.${p}`)}
                </button>
              ))}
            </div>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          <FormField id="price" label={t("services.fields.price")} error={errors.price?.message}>
            <Input
              id="price"
              inputMode="decimal"
              className="h-11 md:h-9"
              {...describedBy("price", errors.price?.message)}
              {...form.register("price")}
            />
          </FormField>
          {priceType === "range" && (
            <FormField id="priceMax" label={t("services.fields.priceMax")} error={errors.priceMax?.message}>
              <Input
                id="priceMax"
                inputMode="decimal"
                className="h-11 md:h-9"
                {...describedBy("priceMax", errors.priceMax?.message)}
                {...form.register("priceMax")}
              />
            </FormField>
          )}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <FormField id="durationMin" label={t("services.fields.duration")} error={errors.durationMin?.message}>
          <Input
            id="durationMin"
            type="number"
            inputMode="numeric"
            min={5}
            max={720}
            step={5}
            className="h-11 md:h-9"
            {...describedBy("durationMin", errors.durationMin?.message)}
            {...form.register("durationMin")}
          />
        </FormField>
        <FormField
          id="bufferAfterMin"
          label={t("services.fields.buffer")}
          error={errors.bufferAfterMin?.message}
        >
          <Input
            id="bufferAfterMin"
            type="number"
            inputMode="numeric"
            min={0}
            max={240}
            step={5}
            className="h-11 md:h-9"
            {...describedBy("bufferAfterMin", errors.bufferAfterMin?.message)}
            {...form.register("bufferAfterMin")}
          />
        </FormField>
      </div>
      <p className="-mt-3 text-xs text-muted-foreground">{t("services.fields.bufferHint")}</p>

      <div className="flex flex-col gap-2">
        <Controller
          control={form.control}
          name="bookableOnline"
          render={({ field }) => (
            <SwitchRow
              label={t("services.fields.bookableOnline")}
              hint={t("services.fields.bookableOnlineHint")}
            >
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </SwitchRow>
          )}
        />
        <Controller
          control={form.control}
          name="active"
          render={({ field }) => (
            <SwitchRow label={t("services.fields.active")} hint={t("services.fields.activeHint")}>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </SwitchRow>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("services.fields.color")}</span>
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <ColorSwatches
              value={field.value}
              onChange={field.onChange}
              label={t("services.fields.color")}
              allowNone
              noneLabel={t("common.none")}
            />
          )}
        />
      </div>

      {isDental && (
        <FormField id="resourceType" label={t("services.fields.resourceType")}>
          <Controller
            control={form.control}
            name="resourceType"
            render={({ field }) => (
              <Select
                value={field.value ?? NONE}
                onValueChange={(v) => field.onChange(v === NONE ? null : v)}
              >
                <SelectTrigger id="resourceType" className="h-11 w-full md:h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("services.fields.resourceNone")}</SelectItem>
                  {resourceTypes.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`services.resourceTypes.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      )}

      <FormField id="description" label={`${t("services.fields.description")} (${t("common.optional")})`}>
        <Textarea id="description" lang={locale} rows={3} {...form.register(`description.${locale}`)} />
      </FormField>

      <FieldError code={formError} />
      <Button type="submit" className="h-11 md:h-9" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}
