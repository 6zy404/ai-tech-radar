import type { Locale } from "@/lib/i18n/locale";

// A natural week's range as the weekly review names it: 「10 月 5 日 – 10 月
// 11 日」, or "Oct 5 – Oct 11" on the English site. Pure and client-safe:
// the signal page renders it in the browser.

const englishMonths = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec"
];

function parseIsoDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function formatDay(date: Date, locale: Locale): string {
  return locale === "en"
    ? `${englishMonths[date.getUTCMonth()]} ${date.getUTCDate()}`
    : `${date.getUTCMonth() + 1} 月 ${date.getUTCDate()} 日`;
}

export function formatWeekRange(
  weekStart: string,
  weekEnd: string,
  locale: Locale = "zh"
): string {
  const start = parseIsoDate(weekStart);
  const end = parseIsoDate(weekEnd);

  if (!start || !end) {
    return `${weekStart} – ${weekEnd}`;
  }

  return `${formatDay(start, locale)} – ${formatDay(end, locale)}`;
}

/** The range of the week that starts on `weekKey` (a Monday). */
export function formatWeekRangeFromKey(
  weekKey: string,
  locale: Locale = "zh"
): string {
  const start = parseIsoDate(weekKey);

  if (!start) {
    return weekKey;
  }

  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  return formatWeekRange(weekKey, end.toISOString().slice(0, 10), locale);
}
