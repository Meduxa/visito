"use client";

// "Forgot password" and "choose a new password" (decision 034).
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { EmptyState } from "@/components/empty-state";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset, setNewPassword } from "../actions";
import { forgotSchema, newPasswordSchema, type ForgotInput, type NewPasswordInput } from "../schema";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string>();
  const form = useForm<ForgotInput>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      const r = await requestPasswordReset(values);
      if (r.ok) setSentTo(values.email);
      else form.setError("email", { message: r.error });
    }),
  );

  if (sentTo)
    return (
      <EmptyState
        className="py-4"
        icon={<MailCheck />}
        title={t("forgot.sentTitle")}
        description={t("forgot.sentBody", { email: sentTo })}
      />
    );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">{t("email")}</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          className="h-11 md:h-9"
          aria-invalid={!!errors.email}
          aria-describedby="email-error"
          {...form.register("email")}
        />
        <FieldError id="email-error" code={errors.email?.message} />
      </div>
      <Button type="submit" className="h-11 md:h-9" disabled={pending}>
        {t("forgot.submit")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-foreground underline underline-offset-4">
          {t("forgot.back")}
        </Link>
      </p>
    </form>
  );
}

export function NewPasswordForm() {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const form = useForm<NewPasswordInput>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) =>
    startTransition(async () => {
      setFormError(undefined);
      const r = await setNewPassword(values);
      if (r && !r.ok) {
        if (r.field === "password") form.setError("password", { message: r.error });
        else setFormError(r.error);
      }
    }),
  );

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">{t("reset.password")}</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          className="h-11 md:h-9"
          aria-invalid={!!errors.password}
          aria-describedby="password-hint password-error"
          {...form.register("password")}
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          {t("signup.passwordHint")}
        </p>
        <FieldError id="password-error" code={errors.password?.message} />
      </div>
      <FieldError code={formError} />
      <Button type="submit" className="h-11 md:h-9" disabled={pending}>
        {t("reset.submit")}
      </Button>
    </form>
  );
}
