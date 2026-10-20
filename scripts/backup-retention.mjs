/**
 * Which backup snapshots to keep.
 *
 * Until 2026-10-21 `backup:data` kept the newest `BACKUP_KEEP` snapshots by
 * count. A count is not a window: on 2026-10-12 five manual `BACKUP_FORCE=1`
 * copies taken around a data script pushed 09-25, 09-26, 09-30 and 10-01 out
 * of the fourteen slots, so the fourteen snapshots on disk covered nine days.
 * Failed copies (no manifest) counted too. Retention is now by **day**: the
 * newest `keepDays` calendar days that have at least one verified snapshot
 * stay — every snapshot taken on those days, verified or not — and every
 * snapshot outside those days goes, including an unverified copy on a day that
 * never got a verified one.
 *
 * Pure: the script lists the directory and removes what this says to remove.
 */

export const SNAPSHOT_PREFIX = "config-";

const snapshotDayPattern = /^config-(\d{4}-\d{2}-\d{2})_\d{6}(?:-\d+)?$/;

/** `config-2026-10-12_110000-2` → `2026-10-12`; anything else → `undefined`. */
export function getSnapshotDay(name) {
  const match = snapshotDayPattern.exec(name);

  return match ? match[1] : undefined;
}

/**
 * @param {{ name: string, verified: boolean }[]} snapshots
 * @param {number} keepDays
 * @returns {{ keep: string[], remove: string[], ignored: string[], keptDays: string[] }}
 *   `ignored` holds directory names that do not look like a snapshot; they are
 *   neither counted nor deleted, so a stray folder under the backup root is
 *   never removed by this script.
 */
export function planSnapshotRetention(snapshots, keepDays) {
  const days = Math.max(1, Math.floor(keepDays));
  const verifiedDays = [
    ...new Set(
      snapshots
        .filter((snapshot) => snapshot.verified)
        .map((snapshot) => getSnapshotDay(snapshot.name))
        .filter((day) => day !== undefined)
    )
  ].sort();
  const keptDays = verifiedDays.slice(-days);
  const keptDaySet = new Set(keptDays);
  const keep = [];
  const remove = [];
  const ignored = [];

  for (const snapshot of [...snapshots].sort((left, right) =>
    left.name.localeCompare(right.name)
  )) {
    const day = getSnapshotDay(snapshot.name);

    if (day === undefined) {
      ignored.push(snapshot.name);
    } else if (keptDaySet.has(day)) {
      keep.push(snapshot.name);
    } else {
      remove.push(snapshot.name);
    }
  }

  return { keep, remove, ignored, keptDays };
}
