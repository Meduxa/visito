"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { EmptyState } from "@/components/empty-state";
import { FieldError } from "@/components/field-error";
import { Turnstile, type TurnstileHandle } from "@/components/turnstile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { signUp } from "../actions";
import { signUpSchema, type SignUpInput } from "../schema";

export function SignupForm({ next, defaultEmail }: { next: string; defaultEmail?: string }) {
  const t = useTranslations("auth");
  const tl = useTranslations("legal");
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string>();
  const [sentTo, setSentTo] = useState<string>();
  const human = useRef<TurnstileHandle>(null); // bot check before the confirmation email (decision 036)
  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: defaultEmail ?? "", password: "" },
  });
  const { errors } = form.formState;

  // handleSubmit is called in the event, so the bot-check handle is read only then
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) =>
    form.handleSubmit((values) => {
      setFormError(undefined);
      startTransition(async () => {
        const captcha = (await human.current?.token()) ?? "";
        human.current?.reset();
        const result = await signUp(values, next, captcha);
        if (!result) return;
        if (!result.ok) {
          if (result.field === "email" || result.field === "password") {
            form.setError(result.field, { message: result.error });
          } else setFormError(result.error);
        } else if (result.data.needsConfirmation) setSentTo(values.email);
      });
    })(e);

  if (sentTo) {
    return (
      <EmptyState
        className="py-4"
        icon={<MailCheck />}
        title={t("signup.checkEmailTitle")}
        description={t("signup.checkEmailBody", { email: sentTo })}
      />
    );
  }

  const fields = [
    { name: "fullName", type: "text", autoComplete: "name", label: t("signup.fullName") },
    { name: "email", type: "email", autoComplete: "email", label: t("email") },
    { name: "password", type: "password", autoComplete: "new-password", label: t("password") },
  ] as const;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-2">
          <Label htmlFor={f.name}>{f.label}</Label>
          <Input
            id={f.name}
            type={f.type}
            autoComplete={f.autoComplete}
            className="h-11 md:h-9"
            aria-invalid={!!errors[f.name]}
            aria-describedby={`${f.name}-error ${f.name}-hint`}
            {...form.register(f.name)}
          />
          {f.name === "password" && !errors.password && (
            <p id="password-hint" className="text-xs text-muted-foreground">
              {t("signup.passwordHint")}
            </p>
          )}
          <FieldError id={`${f.name}-error`} code={errors[f.name]?.message} />
        </div>
      ))}
      <FieldError code={formError} />
      <Turnstile ref={human} />
      <p className="text-xs text-muted-foreground">
        {tl.rich("agree", {
          terms: (chunks) => (
            <Link
              href="/legal/terms"
              target="_blank"
              className="text-foreground underline underline-offset-4"
            >
              {chunks}
            </Link>
          ),
          privacy: (chunks) => (
            <Link
              href="/legal/privacy"
              target="_blank"
              className="text-foreground underline underline-offset-4"
            >
              {chunks}
            </Link>
          ),
          dpa: (chunks) => (
            <Link href="/legal/dpa" target="_blank" className="text-foreground underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <Button type="submit" className="h-11 md:h-9" disabled={pending}>
        {pending ? t("signup.submit") + "…" : t("signup.submit")}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        {t("signup.haveAccount")}{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="text-foreground underline underline-offset-4"
        >
          {t("signup.loginLink")}
        </Link>
      </p>
    </form>
  );
}
