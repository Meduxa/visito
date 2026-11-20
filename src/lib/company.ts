// Visito's own legal details for the main page and the legal pages. Levan chose
// not to publish them for now (2026-11-14); an empty value is simply not shown.
type Localized = { ka: string; en: string; ru: string };

export const COMPANY: {
  legalName: Localized;
  idCode: string;
  address: string;
  phone: string;
  email: string;
} = {
  legalName: { ka: "", en: "", ru: "" }, // not published (Levan, 2026-11-14)
  idCode: "", // identification code (not published)
  address: "", // legal address
  phone: "", // public phone, e.g. "+995 5XX XX XX XX"
  email: "", // public email for customers
};

export const legalName = (locale: string) =>
  COMPANY.legalName[(["ka", "en", "ru"].includes(locale) ? locale : "ka") as keyof Localized];
