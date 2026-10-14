import { headers } from "next/headers";

import { localeRequestHeader, type Locale } from "@/lib/i18n/locale";

/**
 * The interface language of the request being rendered, from the header
 * `src/middleware.ts` sets. Only the root layout and the not-found page need
 * this: every page receives its locale from its own route file.
 */
export async function getRequestLocale(): Promise<Locale> {
  const value = (await headers()).get(localeRequestHeader);

  return value === "en" ? "en" : "zh";
}
