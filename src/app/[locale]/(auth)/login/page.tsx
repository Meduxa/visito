import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeNext } from "@/features/auth/schema";
import { getCurrentUser } from "@/lib/auth";

export async function generateMetadata({ params }: PageProps<"/[locale]/login">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "auth.login" });
  return { title: t("title") };
}

export default async function LoginPage({ params, searchParams }: PageProps<"/[locale]/login">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next, link } = await searchParams;
  const target = safeNext(next, `/${locale}/dashboard`);
  if (await getCurrentUser()) redirect(target);

  const t = await getTranslations("auth.login");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl">{t("title")}</h1>
        </CardTitle>
        <CardDescription>{link === "expired" ? t("linkExpired") : t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm next={target} />
      </CardContent>
    </Card>
  );
}
