import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/components/password-forms";

export async function generateMetadata({ params }: PageProps<"/[locale]/forgot-password">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth.forgot" });
  return { title: t("title") };
}

// "Forgot password": we email a link to choose a new one (decision 034).
export default async function ForgotPasswordPage({
  params,
  searchParams,
}: PageProps<"/[locale]/forgot-password">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { link } = await searchParams;
  const t = await getTranslations("auth.forgot");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("title")}</h1>
        </CardTitle>
        <CardDescription>{link === "expired" ? t("expired") : t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ForgotPasswordForm />
      </CardContent>
    </Card>
  );
}
