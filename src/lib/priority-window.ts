// Its own module so that interface copy can state the rule without importing
// ranking.ts, which several tests replace with a mock.

/** An `important` signal older than this drops from 立即关注 to 值得跟踪. */
export const importantFreshnessWindowDays = 30;
