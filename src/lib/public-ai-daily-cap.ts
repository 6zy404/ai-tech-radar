// Site-wide daily cap on the four public AI routes
// (POST /api/technologies/{compare,explain,learning-path} and POST /api/ask),
// counted together.
//
// The per-client limiter in public-ai-rate-limit.ts bounds how fast *one*
// address can spend the model budget; nothing bounded the total, so a caller
// with many addresses had no ceiling at all. This is that ceiling: at most
// PUBLIC_AI_DAILY_LIMIT model calls per Asia/Shanghai calendar day, all four
// routes combined, then 429 until midnight.
//
// Two things about what is counted:
//
// - A request counts only when it is about to call the model. The three
//   cached routes count after the cache lookup misses (a hit costs nothing);
//   /api/ask has no cache and counts every question. So the check in the
//   guard reads the count, and the generator records the call.
// - The count lives in a file, not in memory, because a deploy restarts the
//   server (2–3 seconds of downtime) and an in-memory count would start the
//   day over. It is one small JSON object, read-modify-write on every counted
//   call; at 500 a day that is nothing.

import type { PublicAiRouteId } from "@/lib/public-ai-rate-limit";
import {
  getLocalStoreFilePath,
  LocalJsonStoreError,
  readLocalJsonFile,
  writeLocalJsonFile
} from "@/lib/repositories/local-json-store";

/** Default when PUBLIC_AI_DAILY_LIMIT is unset or not a positive number. */
export const PUBLIC_AI_DAILY_LIMIT_DEFAULT = 500;

/** The calendar the cap is counted in: the site's clock, no DST. */
export const publicAiDailyCapTimeZone = "Asia/Shanghai";

export const publicAiUsageFileName = "public-ai-usage.json";

export type PublicAiUsageByRoute = Partial<Record<PublicAiRouteId, number>>;

export interface PublicAiUsageRecord {
  /** The Asia/Shanghai day the counts belong to, YYYY-MM-DD. */
  day: string;
  /** Model calls made that day across all four routes. */
  total: number;
  byRoute: PublicAiUsageByRoute;
  updatedAt: string;
}

export type PublicAiDailyCapDecision =
  | { allowed: true; used: number; limit: number }
  | { allowed: false; used: number; limit: number; retryAfterSeconds: number };

export function getPublicAiDailyLimit(): number {
  const raw = process.env.PUBLIC_AI_DAILY_LIMIT?.trim();

  if (!raw) {
    return PUBLIC_AI_DAILY_LIMIT_DEFAULT;
  }

  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0
    ? Math.floor(parsed)
    : PUBLIC_AI_DAILY_LIMIT_DEFAULT;
}

const dayPartsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: publicAiDailyCapTimeZone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
});

function getZonedParts(now: Date): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts: Record<string, number> = {};

  for (const part of dayPartsFormat.formatToParts(now)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
}

/** The Asia/Shanghai calendar day an instant falls on, YYYY-MM-DD. */
export function getPublicAiUsageDay(now: Date = new Date()): string {
  const { year, month, day } = getZonedParts(now);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Seconds from `now` to the next 00:00 in the cap's time zone — what a 429's
 * Retry-After carries. Computed from the zone's wall clock at `now`, so it
 * does not depend on the process's own time zone; at least 1.
 */
export function getSecondsUntilNextDay(now: Date = new Date()): number {
  const { year, month, day, hour, minute, second } = getZonedParts(now);
  // The zone's offset at `now`: its wall clock read as UTC, minus the
  // instant itself (both to the second; the formatter drops milliseconds).
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  const nowToTheSecond = Math.floor(now.getTime() / 1000) * 1000;
  const offsetMs = wallClockAsUtc - nowToTheSecond;
  const nextMidnightUtc = Date.UTC(year, month - 1, day + 1) - offsetMs;

  return Math.max(1, Math.ceil((nextMidnightUtc - now.getTime()) / 1000));
}

function getUsageFilePath(): string {
  return getLocalStoreFilePath(publicAiUsageFileName);
}

function emptyUsage(day: string, now: Date): PublicAiUsageRecord {
  return { day, total: 0, byRoute: {}, updatedAt: now.toISOString() };
}

function normalizeCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function readStoredUsage(): Partial<PublicAiUsageRecord> | undefined {
  try {
    return readLocalJsonFile<Partial<PublicAiUsageRecord> | undefined>(
      getUsageFilePath(),
      undefined
    );
  } catch (error) {
    // The one store where falling back to empty is right: it holds today's
    // count and nothing else, so a file that does not parse costs at most one
    // day's budget, while throwing here would turn every public AI request
    // into a 500 until someone fixed the file by hand. The next counted call
    // rewrites it whole.
    if (error instanceof LocalJsonStoreError) {
      console.warn(`[public-ai-daily-cap] ${error.message}`);
      return undefined;
    }

    throw error;
  }
}

/**
 * Today's usage. A stored record from another day reads as an empty one for
 * today (the day rolled over); the file is not rewritten until the next
 * counted call, so a read never writes.
 */
export function readPublicAiUsage(now: Date = new Date()): PublicAiUsageRecord {
  const today = getPublicAiUsageDay(now);
  const stored = readStoredUsage();

  if (!stored || stored.day !== today) {
    return emptyUsage(today, now);
  }

  const byRoute: PublicAiUsageByRoute = {};

  for (const [routeId, count] of Object.entries(stored.byRoute ?? {})) {
    const normalized = normalizeCount(count);

    if (normalized > 0) {
      byRoute[routeId as PublicAiRouteId] = normalized;
    }
  }

  return {
    day: today,
    total: normalizeCount(stored.total),
    byRoute,
    updatedAt:
      typeof stored.updatedAt === "string"
        ? stored.updatedAt
        : now.toISOString()
  };
}

/**
 * The guard's check: has today's budget been spent? Reads only. Runs after the
 * request-shape guard and the per-client limiter and before the body is read,
 * so a cross-site call or one address hammering the site never reaches it, and
 * a spent budget costs no body read.
 */
export function checkPublicAiDailyCap(
  now: Date = new Date()
): PublicAiDailyCapDecision {
  const limit = getPublicAiDailyLimit();
  const { total } = readPublicAiUsage(now);

  if (total >= limit) {
    return {
      allowed: false,
      used: total,
      limit,
      retryAfterSeconds: getSecondsUntilNextDay(now)
    };
  }

  return { allowed: true, used: total, limit };
}

/**
 * Counts one model call. Called where the call is certain: after a cache
 * miss on the three cached routes, before every /api/ask run. Read-modify-
 * write of the whole file; a record from an earlier day is replaced, which is
 * how the count resets at midnight.
 */
export function recordPublicAiCall(
  routeId: PublicAiRouteId,
  now: Date = new Date()
): PublicAiUsageRecord {
  const current = readPublicAiUsage(now);
  const next: PublicAiUsageRecord = {
    day: current.day,
    total: current.total + 1,
    byRoute: {
      ...current.byRoute,
      [routeId]: (current.byRoute[routeId] ?? 0) + 1
    },
    updatedAt: now.toISOString()
  };

  writeLocalJsonFile(getUsageFilePath(), next);

  return next;
}

/**
 * Same as `recordPublicAiCall`, but a failure to write the count never fails
 * the reader's request: the model call goes ahead uncounted and the error is
 * logged. The routes use this one.
 */
export function tryRecordPublicAiCall(routeId: PublicAiRouteId): void {
  try {
    recordPublicAiCall(routeId);
  } catch (error) {
    console.warn(
      `[public-ai-daily-cap] could not record a ${routeId} call:`,
      error instanceof Error ? error.message : error
    );
  }
}

export interface PublicAiDailyUsageSummary extends PublicAiUsageRecord {
  limit: number;
  /** `total / limit`, not clamped, so 1.2 reads as over the cap. */
  ratio: number;
}

/** For the workspace operations dashboard. Never for a public route. */
export function getPublicAiDailyUsage(
  now: Date = new Date()
): PublicAiDailyUsageSummary {
  const usage = readPublicAiUsage(now);
  const limit = getPublicAiDailyLimit();

  return { ...usage, limit, ratio: limit > 0 ? usage.total / limit : 0 };
}
