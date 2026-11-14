import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NewPasswordForm } from "@/features/auth/components/password-forms";
import { getCurrentUser } from "@/lib/auth";

export async function generateMetadata({ params }: PageProps<"/[locale]/reset-password">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth.reset" });
  return { title: t("title") };
}

// Opened from the "new password" email, which already signed the person in
// (/api/auth/confirm). Without that session the link was used or has expired.
export default async function ResetPasswordPage({ params }: PageProps<"/[locale]/reset-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  if (!user) redirect(`/${locale}/forgot-password?link=expired`);
  const t = await getTranslations("auth.reset");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("title")}</h1>
        </CardTitle>
        <CardDescription>{t("subtitle", { email: user.email })}</CardDescription>
      </CardHeader>
      <CardContent>
        <NewPasswordForm />
      </CardContent>
    </Card>
  );
}
