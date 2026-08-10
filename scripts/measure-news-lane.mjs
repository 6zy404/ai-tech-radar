#!/usr/bin/env node

/**
 * 量一件没有任何页面展示的事：公开快讯页此刻的构成。
 *
 * `/workspace/sources` 已经给出每个源的成功率、重复率、转化率与质量档位
 * （`evaluateSourceQuality`），所以这里刻意不重复算那些。它回答的是另一个
 * 问题——**读者现在在 /technologies?view=news 上看到的是谁的东西**。
 *
 * 这个区别有实际后果：快讯页只过滤 `rejected`，所以**尚未处置（new）的候选
 * 是公开可见的**。日更媒体类信源的产出速率比厂商博客高一个量级，于是在
 * 「导入完成」到「编辑轮处置」之间，公开页会被它们主导。2026-08-10 实测：
 * 处置前 33 条里 22 条（67%）来自两个中文源，处置后降到 16 条里 6 条。
 *
 * 只读，不写任何存储。
 */

import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.LOCAL_DATA_DIR ?? "config";
const read = (file) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, file), "utf8"));

const windowDays = 7;
const fallbackTag = "fallback";

function main() {
  const snapshot = read("imported-candidates.live.json");
  const review = read("candidate-review-state.json");
  const candidates = snapshot.candidates ?? snapshot;
  const items = review.items ?? {};

  // 有效状态必须走评审状态，快照里烘焙的那个会过期（playbook Step 1）。
  const effective = (candidate) => {
    const state = items[candidate.id];
    return state
      ? (state.importStatus ?? state.status)
      : candidate.importStatus;
  };

  const now = new Date();
  const floor = new Date(now);
  floor.setDate(floor.getDate() - windowDays);

  const shown = candidates.filter((candidate) => {
    if (effective(candidate) === "rejected") return false;
    if ((candidate.tags ?? []).includes(fallbackTag)) return false;
    const published = new Date(candidate.publishDate);
    return (
      !Number.isNaN(published.valueOf()) &&
      published >= floor &&
      published <= now
    );
  });

  const bySource = new Map();
  for (const candidate of shown) {
    const key = candidate.sourceName ?? "(未知来源)";
    const row = bySource.get(key) ?? { total: 0, undecided: 0 };
    row.total += 1;
    if (effective(candidate) === "new") row.undecided += 1;
    bySource.set(key, row);
  }

  const total = shown.length;
  const undecided = shown.filter((c) => effective(c) === "new").length;

  console.log(`快讯窗口：最近 ${windowDays} 天 · 数据目录 ${dataDir}`);
  console.log(`公开可见 ${total} 条，其中尚未处置 ${undecided} 条\n`);
  console.log(
    "来源".padEnd(24) +
      "可见".padStart(5) +
      "未处置".padStart(8) +
      "占比".padStart(8)
  );

  const rows = [...bySource.entries()].sort((a, b) => b[1].total - a[1].total);
  for (const [name, row] of rows) {
    const share = total ? Math.round((row.total / total) * 100) : 0;
    console.log(
      name.padEnd(24) +
        String(row.total).padStart(5) +
        String(row.undecided).padStart(8) +
        `${share}%`.padStart(8)
    );
  }

  if (undecided > 0) {
    console.log(
      `\n提示：${undecided} 条尚未处置的候选此刻对读者可见。跑一轮编辑轮` +
        `（/workspace/editorial-round）会把其中的噪声移出公开面。`
    );
  }
}

main();
