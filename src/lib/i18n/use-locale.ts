"use client";

import { usePathname } from "next/navigation";

import { getPathLocale, type Locale } from "@/lib/i18n/locale";

/**
 * The interface language of the page a client component is on, read from
 * the address rather than from a provider: the root layout persists across
 * client navigation, so a value it handed down could go stale, while the
 * pathname never does.
 */
export function useLocale(): Locale {
  return getPathLocale(usePathname() ?? "/");
}
