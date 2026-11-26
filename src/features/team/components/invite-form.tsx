"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { INVITE_REVOKED } from "./revoke-invite-button";
import { Controller, useForm } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { inviteMember } from "../actions";
import { inviteRoles, inviteSchema, type InviteInput } from "../schema";

export function InviteForm() {
  const t = useTranslations();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [created, setCreated] = useState<{ email: string; link: string }>();
  const [copied, setCopied] = useState(false);
  const form = useForm<InviteInput>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "staff" },
  });
  const { errors } = form.formState;

  // a cancelled invitation's link no longer works: stop showing it
  useEffect(() => {
    const onRevoked = (e: Event) =>
      setCreated((c) => (c && c.email === (e as CustomEvent<string>).detail ? undefined : c));
    window.addEventListener(INVITE_REVOKED, onRevoked);
    return () => window.removeEventListener(INVITE_REVOKED, onRevoked);
  }, []);

  const onSubmit = form.handleSubmit((values) => {
    setFormError(undefined);
    setCreated(undefined);
    startTransition(async () => {
      const result = await inviteMember(values);
      if (!result.ok) {
        if (result.field === "email") form.setError("email", { message: result.error });
        else setFormError(result.error);
        return;
      }
      setCreated({ email: values.email, link: result.data.link });
      setCopied(false);
      // back to "staff" each time, so nobody is made an administrator by accident
      form.reset({ email: "", role: "staff" });
    });
  });

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start"
      >
        <div className="flex flex-1 flex-col gap-2 sm:min-w-64">
          <Label htmlFor="invite-email">{t("auth.email")}</Label>
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            className="h-11 md:h-9"
            aria-invalid={!!errors.email}
            aria-describedby="invite-email-error"
            {...form.register("email")}
          />
          <FieldError id="invite-email-error" code={errors.email?.message} />
        </div>
        <div className="flex flex-col gap-2 sm:w-48">
          <Label htmlFor="invite-role">{t("team.role")}</Label>
          <Controller
            control={form.control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="invite-role" className="h-11 w-full md:h-9">
                  {/* text given here, so it shows before the page finishes loading too */}
                  <SelectValue>{t(`roles.${field.value}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {inviteRoles.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(`roles.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <Button type="submit" disabled={pending} className="h-11 sm:mt-[1.375rem] md:h-9">
          {t("team.inviteSubmit")}
        </Button>
      </form>
      <FieldError code={formError} />

      {created && (
        <div role="status" className="flex flex-col gap-2 rounded-lg bg-muted p-3 text-sm">
          <p>{t("team.linkReady", { email: created.email })}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              readOnly
              value={created.link}
              className="h-11 bg-background font-mono text-xs md:h-9"
              aria-label={t("team.link")}
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 md:h-9"
              onClick={async () => {
                await navigator.clipboard.writeText(created.link);
                setCopied(true);
              }}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? t("team.copied") : t("team.copy")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("team.emailNote")}</p>
        </div>
      )}
    </div>
  );
}
