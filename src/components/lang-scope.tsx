import type { ReactNode } from "react";

/**
 * Wraps content in a `lang` element only when one is needed. With no `lang`
 * — every Chinese page — it renders its children as they are, so the
 * Chinese site's markup does not gain a wrapper.
 */
export function LangScope({
  lang,
  children
}: {
  lang?: string;
  children: ReactNode;
}) {
  return lang ? <div lang={lang}>{children}</div> : <>{children}</>;
}
