import type { Locale } from "@/lib/i18n/locale";

/**
 * The `lang` attribute for content shown on a page whose interface is in
 * another language: Chinese-only skills, knowledge and signals on the
 * English site, so a screen reader reads them as Chinese.
 *
 * On the Chinese site it is always `undefined`, which React leaves out of
 * the HTML — Chinese pages render exactly as before the English interface.
 */
export function contentLangAttr(
  locale: Locale,
  textLanguage: "zh" | "en" = "zh"
): string | undefined {
  return locale === "en" && textLanguage === "zh" ? "zh-CN" : undefined;
}
