"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SMS_SALON_TOOLS } from "@/lib/pilot";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { FieldError } from "@/components/field-error";
import { describedBy, FormField, SwitchRow } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveClient } from "../actions";
import type { ClientField, CustomValues } from "../fields";
import type { ClientRow } from "../queries";
import { clientSchema, clientSources, genders, type ClientInput } from "../schema";

const NONE = "__none";

export function ClientForm({
  client,
  staff,
  fields = [],
  readOnly,
  onSaved,
}: {
  client: ClientRow | null;
  staff: { id: string; name: string }[];
  /** the business's own fields (decision 026) */
  fields?: ClientField[];
  readOnly: boolean;
  onSaved: (id: string) => void;
}) {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [tagsText, setTagsText] = useState(client?.tags.join(", ") ?? "");
  const [custom, setCustom] = useState<CustomValues>(client?.custom ?? {});
  const form = useForm<ClientInput>({
    resolver: zodResolver(clientSchema) as never,
    defaultValues: {
      firstName: client?.firstName ?? "",
      lastName: client?.lastName ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      birthday: client?.birthday ?? "",
      gender: client?.gender ?? null,
      source: (client?.source as ClientInput["source"]) ?? null,
      tags: client?.tags ?? [],
      notes: client?.notes ?? "",
      importantNote: client?.importantNote ?? "",
      preferredStaffId: client?.preferredStaffId ?? null,
      blockedOnline: client?.blockedOnline ?? false,
      consentSms: client?.consentSms ?? false,
      consentEmail: client?.consentEmail ?? false,
    },
    disabled: readOnly,
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(() => {
    setFormError(undefined);
    const tags = tagsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    startTransition(async () => {
      const r = await saveClient(client?.id ?? null, {
        ...form.getValues(),
        tags,
        ...(fields.length > 0 && { custom }),
      });
      if (!r.ok) {
        if (r.field === "phone") return form.setError("phone", { message: r.error });
        return setFormError(r.error);
      }
      toast.success(t("common.saved"));
      onSaved(r.data.id);
    });
  });

  const text = (name: "firstName" | "lastName" | "phone" | "email" | "birthday", extra: object = {}) => (
    <Input
      id={name}
      className="h-11 md:h-9"
      {...describedBy(name, errors[name]?.message)}
      {...extra}
      {...form.register(name)}
    />
  );
  const choose = <K extends "gender" | "source" | "preferredStaffId">(
    name: K,
    options: { value: string; label: string }[],
  ) => (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <Select
          value={(field.value as string | null) ?? NONE}
          onValueChange={(v) => field.onChange(v === NONE ? null : v)}
          disabled={readOnly}
        >
          <SelectTrigger id={name} className="h-11 w-full md:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {client?.importantNote && (
        <div role="note" className="flex gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning-ink">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{client.importantNote}</span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="firstName" label={t("clients.fields.firstName")} error={errors.firstName?.message}>
          {text("firstName", { autoComplete: "off" })}
        </FormField>
        <FormField id="lastName" label={t("clients.fields.lastName")} error={errors.lastName?.message}>
          {text("lastName", { autoComplete: "off" })}
        </FormField>
        <FormField id="phone" label={t("clients.fields.phone")} error={errors.phone?.message}>
          {text("phone", { type: "tel", inputMode: "tel", autoComplete: "off" })}
        </FormField>
        <FormField id="email" label={t("clients.fields.email")} error={errors.email?.message}>
          {text("email", { type: "email", inputMode: "email", autoComplete: "off" })}
        </FormField>
        <FormField id="birthday" label={t("clients.fields.birthday")} error={errors.birthday?.message}>
          {text("birthday", { type: "date" })}
        </FormField>
        <FormField id="gender" label={t("clients.fields.gender")}>
          {choose(
            "gender",
            genders.map((g) => ({ value: g, label: t(`clients.genders.${g}`) })),
          )}
        </FormField>
        <FormField id="source" label={t("clients.fields.source")}>
          {choose(
            "source",
            clientSources.map((s) => ({ value: s, label: t(`clients.sources.${s}`) })),
          )}
        </FormField>
        <FormField id="preferredStaffId" label={t("clients.fields.preferredStaff")}>
          {choose(
            "preferredStaffId",
            staff.map((s) => ({ value: s.id, label: s.name })),
          )}
        </FormField>
      </div>

      <FormField
        id="importantNote"
        label={t("clients.fields.importantNote")}
        hint={t("clients.fields.importantNoteHint")}
        error={errors.importantNote?.message}
      >
        <Input id="importantNote" className="h-11 md:h-9" {...form.register("importantNote")} />
      </FormField>
      <FormField id="tags" label={t("clients.fields.tags")} hint={t("clients.fields.tagsHint")}>
        <Input
          id="tags"
          value={tagsText}
          disabled={readOnly}
          onChange={(e) => setTagsText(e.target.value)}
          className="h-11 md:h-9"
        />
      </FormField>
      <FormField id="notes" label={t("clients.fields.notes")} error={errors.notes?.message}>
        <Textarea id="notes" rows={3} {...form.register("notes")} />
      </FormField>

      {fields.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-medium">{t("clients.ownFields.title")}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <OwnField
                key={f.id}
                field={f}
                value={custom[f.id]}
                readOnly={readOnly}
                onChange={(v) =>
                  setCustom((c) => {
                    const next = { ...c };
                    if (v === undefined) delete next[f.id];
                    else next[f.id] = v;
                    return next;
                  })
                }
              />
            ))}
          </div>
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2">
        {/* marketing consent is not asked during the pilot (decision 033) */}
        {SMS_SALON_TOOLS && (
          <>
            <legend className="mb-1 text-sm font-medium">{t("clients.consent.title")}</legend>
            <p className="mb-1 text-xs text-muted-foreground">{t("clients.consent.hint")}</p>
          </>
        )}
        {(SMS_SALON_TOOLS ? (["consentSms", "consentEmail"] as const) : []).map((name) => (
          <Controller
            key={name}
            control={form.control}
            name={name}
            render={({ field }) => (
              <SwitchRow label={t(name === "consentSms" ? "clients.consent.sms" : "clients.consent.email")}>
                <Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} />
              </SwitchRow>
            )}
          />
        ))}
        <Controller
          control={form.control}
          name="blockedOnline"
          render={({ field }) => (
            <SwitchRow label={t("clients.fields.blockedOnline")} hint={t("clients.fields.blockedOnlineHint")}>
              <Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly} />
            </SwitchRow>
          )}
        />
      </fieldset>

      <FieldError code={formError} />
      {!readOnly && (
        <Button type="submit" className="h-11 self-start md:h-9" disabled={pending}>
          {t("common.save")}
        </Button>
      )}
    </form>
  );
}

function OwnField({
  field,
  value,
  readOnly,
  onChange,
}: {
  field: ClientField;
  value: string | number | boolean | undefined;
  readOnly: boolean;
  onChange: (v: string | number | boolean | undefined) => void;
}) {
  const t = useTranslations("clients.ownFields");
  const id = `own-${field.id}`;
  if (field.kind === "yesno")
    return (
      <SwitchRow label={field.label}>
        <Switch
          id={id}
          checked={value === true}
          disabled={readOnly}
          onCheckedChange={(on) => onChange(on ? true : undefined)}
        />
      </SwitchRow>
    );
  if (field.kind === "choice")
    return (
      <FormField id={id} label={field.label}>
        <Select
          value={typeof value === "string" ? value : NONE}
          onValueChange={(v) => onChange(v === NONE ? undefined : v)}
          disabled={readOnly}
        >
          <SelectTrigger id={id} className="h-11 w-full md:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {field.options.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>
    );
  return (
    <FormField id={id} label={field.label} hint={field.kind === "text" ? t("textHint") : undefined}>
      <Input
        id={id}
        type={field.kind === "date" ? "date" : "text"}
        inputMode={field.kind === "number" ? "decimal" : undefined}
        maxLength={field.kind === "text" ? 500 : undefined}
        disabled={readOnly}
        className="h-11 md:h-9"
        value={value === undefined || typeof value === "boolean" ? "" : String(value)}
        onChange={(e) => onChange(e.target.value === "" ? undefined : e.target.value)}
      />
    </FormField>
  );
}
