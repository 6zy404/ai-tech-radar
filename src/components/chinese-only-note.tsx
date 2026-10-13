import type { Locale } from "@/lib/i18n/locale";

/**
 * The one line an English page carries when some of what it shows exists
 * only in Chinese — skills, knowledge, signals from Chinese-language sources,
 * editors' write-ups. Said once per page, where the Chinese content starts,
 * never per card. Renders nothing on the Chinese site.
 */
export function ChineseOnlyNote({
  locale,
  children,
  className
}: {
  locale: Locale;
  children: string;
  className?: string;
}) {
  if (locale !== "en") {
    return null;
  }

  return (
    <p className={`chinese-only-note${className ? ` ${className}` : ""}`}>
      {children}
    </p>
  );
}
