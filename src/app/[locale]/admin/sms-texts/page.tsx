import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SmsTextsEditor, type TextType } from "@/features/platform/components/sms-texts-editor";
import { builtInText, PLATFORM_TEXT_TYPES } from "@/features/sms/texts";
import { createClient } from "@/lib/supabase/server";

// Visito's SMS texts for every business (decision 033). The layout already
// allows platform admins only; the table's policies check it again.
export async function generateMetadata({ params }: PageProps<"/[locale]/admin/sms-texts">) {
  const t = await getTranslations({ locale: (await params).locale, namespace: "platform" });
  return { title: t("nav.smsTexts") };
}

export default async function AdminSmsTextsPage({ params }: PageProps<"/[locale]/admin/sms-texts">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("platform");
  const { data } = await (await createClient()).from("sms_platform_templates").select("type, locale, body");
  const defaults = Object.fromEntries(
    await Promise.all(
      (["ka", "en", "ru"] as const).map(async (l) => [
        l,
        Object.fromEntries(
          await Promise.all(PLATFORM_TEXT_TYPES.map(async (type) => [type, await builtInText(type, l)])),
        ),
      ]),
    ),
  );

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={t("nav.smsTexts")} description={t("smsTexts.hint")} />
      <SmsTextsEditor
        types={PLATFORM_TEXT_TYPES as readonly TextType[]}
        saved={(data ?? []) as { type: TextType; locale: "ka" | "en" | "ru"; body: string }[]}
        defaults={defaults}
      />
    </div>
  );
}
