"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ColorSwatches } from "@/components/color-swatches";
import { FieldError } from "@/components/field-error";
import { describedBy, FormField, SwitchRow } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveStaff } from "../actions";
import type { StaffMember } from "../queries";
import { positionTypes, staffSchema, type StaffInput } from "../schema";

export function StaffForm({
  staff,
  isDental,
  onSaved,
}: {
  staff: StaffMember | null;
  isDental: boolean;
  onSaved: (id: string) => void;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const form = useForm<StaffInput>({
    resolver: zodResolver(staffSchema) as never,
    defaultValues: {
      displayName: staff?.displayName ?? "",
      position: staff?.position ?? "",
      positionEn: staff?.positionEn ?? "",
      positionRu: staff?.positionRu ?? "",
      positionType: staff?.positionType ?? (isDental ? "doctor" : "master"),
      color: (staff?.color as StaffInput["color"]) ?? "green",
      phone: staff?.phone ?? "",
      email: staff?.email ?? "",
      bio: staff?.bio ?? "",
      bookableOnline: staff?.bookableOnline ?? true,
      active: staff?.active ?? true,
      commissionPct: staff?.commissionPct ?? 0,
    },
  });
  const { errors } = form.formState;
  const field = (
    name: "displayName" | "position" | "positionEn" | "positionRu" | "phone" | "email" | "commissionPct",
    extra: object = {},
  ) => (
    <Input
      id={name}
      className="h-11 md:h-9"
      {...describedBy(name, errors[name]?.message)}
      {...extra}
      {...form.register(name)}
    />
  );

  const onSubmit = form.handleSubmit(() => {
    setFormError(undefined);
    startTransition(async () => {
      const r = await saveStaff(staff?.id ?? null, form.getValues());
      if (!r.ok) return setFormError(r.error);
      toast.success(t("common.saved"));
      onSaved(r.data.id);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormField id="displayName" label={t("staff.fields.displayName")} error={errors.displayName?.message}>
        {field("displayName", { autoComplete: "off" })}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="position" label={t("staff.fields.position")} error={errors.position?.message}>
          {field("position", { placeholder: t("staff.fields.positionPlaceholder") })}
        </FormField>
        <FormField id="positionType" label={t("staff.fields.positionType")}>
          <Controller
            control={form.control}
            name="positionType"
            render={({ field: f }) => (
              <Select value={f.value} onValueChange={f.onChange}>
                <SelectTrigger id="positionType" className="h-11 w-full md:h-9">
                  <SelectValue>{t(`staff.positionTypes.${f.value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {positionTypes.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`staff.positionTypes.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </FormField>
      </div>
      {/* the booking page in English/Russian shows these; empty = the Georgian text */}
      <details className="-mt-2">
        <summary className="cursor-pointer text-sm font-medium text-primary">
          {t("staff.fields.positionOtherLanguages")}
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <FormField id="positionEn" label={t("staff.fields.positionEn")} error={errors.positionEn?.message}>
            {field("positionEn", { lang: "en" })}
          </FormField>
          <FormField id="positionRu" label={t("staff.fields.positionRu")} error={errors.positionRu?.message}>
            {field("positionRu", { lang: "ru" })}
          </FormField>
        </div>
      </details>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">{t("staff.fields.color")}</span>
        <Controller
          control={form.control}
          name="color"
          render={({ field: f }) => (
            <ColorSwatches
              value={f.value}
              onChange={(v) => f.onChange(v ?? "green")}
              label={t("staff.fields.color")}
            />
          )}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          id="phone"
          label={`${t("staff.fields.phone")} (${t("common.optional")})`}
          error={errors.phone?.message}
        >
          {field("phone", { type: "tel", inputMode: "tel", autoComplete: "off" })}
        </FormField>
        <FormField
          id="email"
          label={`${t("staff.fields.email")} (${t("common.optional")})`}
          error={errors.email?.message}
        >
          {field("email", { type: "email", inputMode: "email", autoComplete: "off" })}
        </FormField>
      </div>
      <FormField
        id="bio"
        label={`${t("staff.fields.bio")} (${t("common.optional")})`}
        error={errors.bio?.message}
      >
        <Textarea id="bio" rows={3} {...form.register("bio")} />
      </FormField>
      <div className="flex flex-col gap-2">
        {(["bookableOnline", "active"] as const).map((name) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field: f }) => (
              <SwitchRow label={t(`staff.fields.${name}`)} hint={t(`staff.fields.${name}Hint`)}>
                <Switch checked={f.value} onCheckedChange={f.onChange} />
              </SwitchRow>
            )}
          />
        ))}
      </div>
      <FormField
        id="commissionPct"
        label={t("staff.fields.commission")}
        hint={t("staff.fields.commissionHint")}
        error={errors.commissionPct?.message}
        className="max-w-40"
      >
        {field("commissionPct", { type: "number", inputMode: "decimal", min: 0, max: 100, step: 1 })}
      </FormField>
      <FieldError code={formError} />
      <Button type="submit" className="h-11 self-start md:h-9" disabled={pending}>
        {t("common.save")}
      </Button>
    </form>
  );
}
