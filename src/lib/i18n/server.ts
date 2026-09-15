import { cookies } from "next/headers";
import { cache } from "react";
import { dictionaries, isLocale, type Locale } from "./dictionaries";

export const LOCALE_COOKIE = "cv_locale";

export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const fromCookie = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;
  const fallback = process.env.DEFAULT_LOCALE;
  return isLocale(fallback) ? fallback : "en";
});

export async function getI18n() {
  const locale = await getLocale();
  return { locale, t: dictionaries[locale], dir: locale === "ar" ? ("rtl" as const) : ("ltr" as const) };
}
