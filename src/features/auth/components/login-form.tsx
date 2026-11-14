"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { signIn } from "../actions";
import { signInSchema, type SignInInput } from "../schema";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const form = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setFormError(undefined);
    startTransition(async () => {
      const result = await signIn(values, next);
      if (result && !result.ok) setFormError(result.error);
    });
  });

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
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="password">{t("password")}</Label>
          <Link
            href="/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("login.forgot")}
          </Link>
        </div>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          className="h-11 md:h-9"
          aria-invalid={!!errors.password}
          aria-describedby="password-error"
          {...form.register("password")}
        />
        <FieldError id="password-error" code={errors.password?.message} />
      </div>
      <FieldError code={formError} />
      <Button type="submit" className="h-11 md:h-9" disabled={pending}>
        {pending ? t("login.submit") + "…" : t("login.submit")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("login.noAccount")}{" "}
        <Link
          href={`/signup?next=${encodeURIComponent(next)}`}
          className="text-foreground underline underline-offset-4"
        >
          {t("login.signupLink")}
        </Link>
      </p>
    </form>
  );
}
