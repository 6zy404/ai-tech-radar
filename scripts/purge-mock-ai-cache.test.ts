import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { aiCacheStores, planMockAiCachePurge } from "../src/lib/ai-cache-purge";
import { makeWorkspaceRecord } from "../src/lib/test-factories";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

// A mock explanation as the July cache held them, a real one, and a record
// from before `generationMode` existed (read as mock, as the guard reads it).
const mockExplanation = {
  id: "technology-explanation-mock",
  cacheKey: "tech-pub::intermediate",
  technologyId: "tech-pub",
  audienceLevel: "intermediate",
  fields: { explanation: "……是一个值得跟踪的技术信号", keyPoints: ["模板"] },
  generationMode: "mock_llm",
  providerName: "mock",
  modelName: "mock-llm",
  promptVersion: "mock-technology-explanation-v0",
  outputValidationStatus: "valid",
  outputValidationWarnings: [],
  createdAt: "2026-07-10T08:00:00.000Z",
  updatedAt: "2026-07-10T08:00:00.000Z"
};

const realExplanation = {
  id: "technology-explanation-real",
  cacheKey: "tech-pub::beginner",
  technologyId: "tech-pub",
  audienceLevel: "beginner",
  fields: { explanation: "真实模型写的解读", keyPoints: ["要点"] },
  generationMode: "llm_assisted",
  providerName: "openai_compatible",
  modelName: "deepseek-chat",
  promptVersion: "technology-explanation-v1",
  outputValidationStatus: "valid",
  outputValidationWarnings: [],
  createdAt: "2026-10-01T08:00:00.000Z",
  updatedAt: "2026-10-01T08:00:00.000Z"
};

const legacyExplanation = {
  id: "technology-explanation-legacy",
  cacheKey: "tech-gone::advanced",
  technologyId: "tech-gone",
  audienceLevel: "advanced",
  fields: { explanation: "没有 generationMode 的旧记录", keyPoints: [] },
  outputValidationStatus: "valid",
  outputValidationWarnings: [],
  createdAt: "2026-07-01T08:00:00.000Z",
  updatedAt: "2026-07-01T08:00:00.000Z"
};

const mockComparison = {
  id: "technology-comparison-mock",
  pairKey: "tech-gone::tech-pub",
  technologyIdA: "tech-gone",
  technologyIdB: "tech-pub",
  fields: {
    similarities: [],
    differences: [],
    whenToPreferA: "",
    whenToPreferB: ""
  },
  generationMode: "mock_llm",
  outputValidationStatus: "valid",
  outputValidationWarnings: [],
  createdAt: "2026-07-12T08:00:00.000Z",
  updatedAt: "2026-07-12T08:00:00.000Z"
};

describe("planMockAiCachePurge", () => {
  it("removes mock records and keeps the rest in their stored order", () => {
    const { kept, removed } = planMockAiCachePurge([
      mockExplanation,
      realExplanation,
      legacyExplanation
    ]);

    expect(removed).toEqual([mockExplanation, legacyExplanation]);
    expect(kept).toEqual([realExplanation]);
  });

  it("keeps a failed real record: the guard already ignores it", () => {
    const failed = { ...realExplanation, outputValidationStatus: "failed" };

    expect(planMockAiCachePurge([failed]).kept).toEqual([failed]);
  });

  it("names each store's key and signals", () => {
    const [explanations, comparisons, learningPaths] = aiCacheStores;

    expect(explanations.keyOf(mockExplanation)).toBe("tech-pub::intermediate");
    expect(explanations.technologyIdsOf(mockExplanation)).toEqual(["tech-pub"]);
    expect(comparisons.keyOf(mockComparison)).toBe("tech-gone::tech-pub");
    expect(comparisons.technologyIdsOf(mockComparison)).toEqual([
      "tech-gone",
      "tech-pub"
    ]);
    expect(learningPaths.keyOf({ technologyId: "tech-pub" })).toBe("tech-pub");
    expect(learningPaths.technologyIdsOf({ technologyId: "tech-pub" })).toEqual(
      ["tech-pub"]
    );
  });
});

describe("scripts/purge-mock-ai-cache.ts", () => {
  let dataDir: string;

  const explanationsPath = () =>
    path.join(dataDir, "technology-explanations.json");
  const comparisonsPath = () =>
    path.join(dataDir, "technology-comparisons.json");
  const learningPathsPath = () =>
    path.join(dataDir, "technology-learning-paths.json");

  const run = (...args: string[]) => {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      LOCAL_DATA_DIR: dataDir,
      PERSISTENCE_DRIVER: "json"
    };

    delete env.VALIDATION_DATA_DIR;

    return spawnSync(
      process.execPath,
      [
        path.join(repoRoot, "scripts", "run-ts.cjs"),
        path.join(repoRoot, "scripts", "purge-mock-ai-cache.ts"),
        ...args
      ],
      { cwd: repoRoot, env, encoding: "utf8" }
    );
  };

  beforeEach(() => {
    dataDir = mkdtempSync(path.join(os.tmpdir(), "purge-mock-ai-cache-"));
    writeFileSync(
      path.join(dataDir, "technology-workspace.json"),
      JSON.stringify({
        updatedAt: "2026-10-21T00:00:00.000Z",
        records: [
          makeWorkspaceRecord({
            id: "tech-pub",
            slug: "published-signal",
            status: "published"
          })
        ]
      })
    );
    writeFileSync(
      explanationsPath(),
      JSON.stringify({
        updatedAt: "2026-10-01T08:00:00.000Z",
        explanations: [mockExplanation, realExplanation, legacyExplanation]
      })
    );
    writeFileSync(
      comparisonsPath(),
      JSON.stringify({
        updatedAt: "2026-07-12T08:00:00.000Z",
        comparisons: [mockComparison]
      })
    );
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
  });

  it("previews without writing, naming each record's key and signals", () => {
    const before = {
      explanations: readFileSync(explanationsPath(), "utf8"),
      comparisons: readFileSync(comparisonsPath(), "utf8")
    };

    const result = run();

    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain(`数据目录：${dataDir}`);
    expect(result.stdout).toContain("只读预演");
    expect(result.stdout).toContain("删除 tech-pub::intermediate");
    expect(result.stdout).toContain("信号：published-signal");
    expect(result.stdout).toContain("删除 tech-gone::advanced");
    expect(result.stdout).toContain("tech-gone（未发布）");
    expect(result.stdout).toContain("mock-technology-explanation-v0");
    expect(result.stdout).toContain("删除 tech-gone::tech-pub");
    expect(result.stdout).toContain("学习路径缓存");
    expect(result.stdout).toContain("文件不存在");
    expect(result.stdout).toContain(
      "预览：待删除 3 条 mock 记录，保留 1 条。未写入任何文件。"
    );
    expect(result.stdout).not.toContain("tech-pub::beginner");

    expect(readFileSync(explanationsPath(), "utf8")).toBe(before.explanations);
    expect(readFileSync(comparisonsPath(), "utf8")).toBe(before.comparisons);
    expect(existsSync(learningPathsPath())).toBe(false);
  }, 60_000);

  it("--apply removes the mock records, keeps the real one unchanged, and a second run finds nothing", () => {
    const applied = run("--apply");

    expect(applied.status, applied.stderr).toBe(0);
    expect(applied.stdout).toContain(
      "已写入 2 个文件：删除 3 条 mock 记录，保留 1 条。"
    );

    const explanations = JSON.parse(readFileSync(explanationsPath(), "utf8"));
    const comparisons = JSON.parse(readFileSync(comparisonsPath(), "utf8"));

    expect(explanations.explanations).toEqual([realExplanation]);
    expect(explanations.updatedAt).not.toBe("2026-10-01T08:00:00.000Z");
    expect(comparisons.comparisons).toEqual([]);
    expect(existsSync(learningPathsPath())).toBe(false);

    const again = run("--apply");

    expect(again.status, again.stderr).toBe(0);
    expect(again.stdout).toContain(
      "无事可做：三个缓存共 1 条记录，没有 mock 生成的。"
    );
    expect(JSON.parse(readFileSync(explanationsPath(), "utf8"))).toEqual(
      explanations
    );
  }, 90_000);
});
