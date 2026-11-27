// Optional English/Russian versions of a few business texts (branch name and
// address, staff position) stored as `translations` = {"en": {...}, "ru": {...}}.
// Georgian lives in the normal columns and is always the fallback.

export const TRANSLATED_LOCALES = ["en", "ru"] as const;
export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];
export type Translations = Partial<Record<TranslatedLocale, Record<string, string>>>;

/** The text in `locale` when one was entered, otherwise `fallback`. */
export function pickText<T extends string | null>(
  translations: unknown,
  locale: string,
  field: string,
  fallback: T,
): string | T {
  if (fallback === null || !translations || typeof translations !== "object") return fallback;
  const byLocale = (translations as Record<string, unknown>)[locale];
  if (!byLocale || typeof byLocale !== "object") return fallback;
  const value = (byLocale as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** Builds the stored object from form fields, dropping empty ones. */
export function buildTranslations(
  values: Partial<Record<TranslatedLocale, Record<string, string | undefined>>>,
): Translations {
  const out: Translations = {};
  for (const l of TRANSLATED_LOCALES) {
    const fields = Object.entries(values[l] ?? {}).filter(([, v]) => v && v.trim());
    if (fields.length) out[l] = Object.fromEntries(fields.map(([k, v]) => [k, v!.trim()]));
  }
  return out;
}

/** Reads one field for a form's default values. */
export const translationOf = (translations: unknown, locale: TranslatedLocale, field: string) =>
  pickText(translations, locale, field, "" as string);
