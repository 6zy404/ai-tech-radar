#!/usr/bin/env node
/**
 * Daily backup of the local workflow data directory (`LOCAL_DATA_DIR`).
 *
 * Why this exists: the JSON store has no multi-writer locking, and the
 * scheduled task runner writes to the same files the operator edits through
 * the workspace UI (`docs/production-readiness.md` -> I2). Until this script
 * there was no copy of `config/` anywhere — a bad write or an accidental
 * delete was unrecoverable. This is deliberately the smallest thing that
 * closes that hole: a timestamped copy plus a manifest, no dependencies.
 *
 * What it does NOT protect against, stated plainly: the backup lands on the
 * same physical disk, so it does not survive a disk failure. It survives the
 * failure mode this project actually hits — a store written wrong, truncated,
 * or removed.
 *
 * Environment:
 *   LOCAL_DATA_DIR   source directory (default: <repo>/config)
 *   BACKUP_DIR       destination root (default: <userprofile>/ai-tech-radar-backups)
 *   BACKUP_KEEP      how many snapshots to retain (default: 14)
 *
 * Exit code is non-zero on any failure so Task Scheduler records it as failed
 * instead of silently reporting success.
 */

import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

const SNAPSHOT_PREFIX = "config-";

function resolveSourceDir() {
  const configured = process.env.LOCAL_DATA_DIR;

  if (!configured) {
    return path.join(repoRoot, "config");
  }

  return path.isAbsolute(configured)
    ? configured
    : path.resolve(repoRoot, configured);
}

function resolveBackupRoot() {
  return (
    process.env.BACKUP_DIR ?? path.join(homedir(), "ai-tech-radar-backups")
  );
}

function resolveKeepCount() {
  const raw = Number(process.env.BACKUP_KEEP ?? 14);

  return Number.isFinite(raw) && raw >= 1 ? Math.floor(raw) : 14;
}

/** `2026-08-10_081500` — sorts lexicographically in chronological order. */
function buildSnapshotName(now) {
  const pad = (value) => String(value).padStart(2, "0");

  return (
    `${SNAPSHOT_PREFIX}${now.getFullYear()}-${pad(now.getMonth() + 1)}-` +
    `${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}` +
    `${pad(now.getSeconds())}`
  );
}

function reserveSnapshotPath(backupRoot, baseName) {
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const snapshotName = attempt === 1 ? baseName : `${baseName}-${attempt}`;
    const snapshotDir = path.join(backupRoot, snapshotName);

    if (!existsSync(snapshotDir)) {
      return { snapshotName, snapshotDir };
    }
  }

  throw new Error(`同一秒内备份次数过多，无法分配目录名：${baseName}`);
}

function listFilesRecursively(root, prefix = "") {
  const entries = readdirSync(path.join(root, prefix), {
    withFileTypes: true
  });
  const files = [];

  for (const entry of entries) {
    const relativePath = prefix ? path.join(prefix, entry.name) : entry.name;

    if (entry.isDirectory()) {
      files.push(...listFilesRecursively(root, relativePath));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files.sort();
}

function describeFiles(root) {
  return listFilesRecursively(root).map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    const contents = readFileSync(absolutePath);

    return {
      path: relativePath.split(path.sep).join("/"),
      bytes: contents.byteLength,
      sha256: createHash("sha256").update(contents).digest("hex")
    };
  });
}

/**
 * Compares the copy against the source file-by-file. A backup nobody verified
 * is a backup nobody can rely on, so this runs every time rather than being an
 * optional flag.
 */
function findMismatches(sourceFiles, snapshotFiles) {
  const snapshotByPath = new Map(
    snapshotFiles.map((file) => [file.path, file])
  );
  const mismatches = [];

  for (const sourceFile of sourceFiles) {
    const copied = snapshotByPath.get(sourceFile.path);

    if (!copied) {
      mismatches.push(`missing in backup: ${sourceFile.path}`);
      continue;
    }

    if (copied.sha256 !== sourceFile.sha256) {
      mismatches.push(
        `content differs: ${sourceFile.path} ` +
          `(source ${sourceFile.bytes}B, backup ${copied.bytes}B)`
      );
    }

    snapshotByPath.delete(sourceFile.path);
  }

  for (const extraPath of snapshotByPath.keys()) {
    mismatches.push(`unexpected extra file in backup: ${extraPath}`);
  }

  return mismatches;
}

function pruneOldSnapshots(backupRoot, keepCount) {
  const snapshots = readdirSync(backupRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && entry.name.startsWith(SNAPSHOT_PREFIX)
    )
    .map((entry) => entry.name)
    .sort();

  const removable = snapshots.slice(
    0,
    Math.max(0, snapshots.length - keepCount)
  );

  for (const name of removable) {
    rmSync(path.join(backupRoot, name), { recursive: true, force: true });
  }

  return { removed: removable, retained: snapshots.length - removable.length };
}

function main() {
  const startedAt = new Date();
  const sourceDir = resolveSourceDir();
  const backupRoot = resolveBackupRoot();
  const keepCount = resolveKeepCount();

  if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
    throw new Error(`数据目录不存在：${sourceDir}`);
  }

  const sourceFiles = describeFiles(sourceDir);

  if (sourceFiles.length === 0) {
    throw new Error(`数据目录为空，拒绝写入空备份：${sourceDir}`);
  }

  mkdirSync(backupRoot, { recursive: true });

  // The timestamp is second-resolution, so a retry or a manual re-run in the
  // same second would collide. Suffixing keeps both copies instead of failing
  // the run — found by running this script twice in one second during
  // verification, which is exactly what a Task Scheduler retry looks like.
  const { snapshotName, snapshotDir } = reserveSnapshotPath(
    backupRoot,
    buildSnapshotName(startedAt)
  );

  cpSync(sourceDir, snapshotDir, { recursive: true });

  const snapshotFiles = describeFiles(snapshotDir);
  const mismatches = findMismatches(sourceFiles, snapshotFiles);

  if (mismatches.length > 0) {
    // Keep the bad copy on disk for inspection; deleting it would destroy the
    // only evidence of what went wrong.
    throw new Error(
      `备份校验失败（${mismatches.length} 处不一致）：\n  ` +
        mismatches.slice(0, 10).join("\n  ")
    );
  }

  const totalBytes = sourceFiles.reduce((sum, file) => sum + file.bytes, 0);

  writeFileSync(
    path.join(snapshotDir, "backup-manifest.json"),
    `${JSON.stringify(
      {
        snapshot: snapshotName,
        createdAt: startedAt.toISOString(),
        sourceDir,
        fileCount: sourceFiles.length,
        totalBytes,
        files: sourceFiles
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  const { removed, retained } = pruneOldSnapshots(backupRoot, keepCount);

  console.log(
    `备份成功：${snapshotName}（${sourceFiles.length} 个文件，` +
      `${(totalBytes / 1024).toFixed(1)} KB，校验一致）`
  );
  console.log(`备份目录：${backupRoot}`);
  console.log(
    `保留 ${retained} 份（上限 ${keepCount}）` +
      (removed.length > 0
        ? `，清理 ${removed.length} 份：${removed.join(", ")}`
        : "")
  );
}

try {
  main();
} catch (error) {
  console.error(
    `备份失败：${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
