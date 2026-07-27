import {
  clearTables,
  getTimestamp,
  selectPayloads,
  type SqliteDatabase
} from "@/lib/repositories/sqlite-primitives";
import type {
  TechnologyComparisonRecord,
  TechnologyExplanationRecord,
  TechnologyLearningPathRecord
} from "@/types/content";

/**
 * 三份公开 AI 功能的结果缓存（对比 / 分级解释 / 学习路径）。它们不是编辑内容，
 * 而是「同一个缓存键只生成一次」的成本护栏 —— 在 sqlite 模式下缺适配器时缓存
 * 永远不命中，每次请求都会重新调用 provider，所以必须一起补齐。
 */

export interface TechnologyComparisonStore {
  updatedAt: string;
  comparisons: TechnologyComparisonRecord[];
}

export interface TechnologyExplanationStore {
  updatedAt: string;
  explanations: TechnologyExplanationRecord[];
}

export interface TechnologyLearningPathStore {
  updatedAt: string;
  learningPaths: TechnologyLearningPathRecord[];
}

export function readTechnologyComparisonStore(
  database: SqliteDatabase
): TechnologyComparisonStore {
  return {
    updatedAt: getTimestamp(),
    comparisons: selectPayloads<TechnologyComparisonRecord>(
      database,
      "SELECT payload FROM technology_comparisons ORDER BY updatedAt DESC"
    )
  };
}

export function writeTechnologyComparisonStore(
  database: SqliteDatabase,
  store: TechnologyComparisonStore
): void {
  clearTables(database, ["technology_comparisons"]);

  const insertComparison = database.prepare(`
    INSERT OR REPLACE INTO technology_comparisons (
      id, pairKey, technologyIdA, technologyIdB, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const comparison of store.comparisons ?? []) {
    insertComparison.run(
      comparison.id,
      comparison.pairKey,
      comparison.technologyIdA,
      comparison.technologyIdB,
      comparison.updatedAt,
      JSON.stringify(comparison)
    );
  }
}

export function readTechnologyExplanationStore(
  database: SqliteDatabase
): TechnologyExplanationStore {
  return {
    updatedAt: getTimestamp(),
    explanations: selectPayloads<TechnologyExplanationRecord>(
      database,
      "SELECT payload FROM technology_explanations ORDER BY updatedAt DESC"
    )
  };
}

export function writeTechnologyExplanationStore(
  database: SqliteDatabase,
  store: TechnologyExplanationStore
): void {
  clearTables(database, ["technology_explanations"]);

  const insertExplanation = database.prepare(`
    INSERT OR REPLACE INTO technology_explanations (
      id, cacheKey, technologyId, audienceLevel, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const explanation of store.explanations ?? []) {
    insertExplanation.run(
      explanation.id,
      explanation.cacheKey,
      explanation.technologyId,
      explanation.audienceLevel,
      explanation.updatedAt,
      JSON.stringify(explanation)
    );
  }
}

export function readTechnologyLearningPathStore(
  database: SqliteDatabase
): TechnologyLearningPathStore {
  return {
    updatedAt: getTimestamp(),
    learningPaths: selectPayloads<TechnologyLearningPathRecord>(
      database,
      "SELECT payload FROM technology_learning_paths ORDER BY updatedAt DESC"
    )
  };
}

export function writeTechnologyLearningPathStore(
  database: SqliteDatabase,
  store: TechnologyLearningPathStore
): void {
  clearTables(database, ["technology_learning_paths"]);

  const insertLearningPath = database.prepare(`
    INSERT OR REPLACE INTO technology_learning_paths (
      id, technologyId, updatedAt, payload
    ) VALUES (?, ?, ?, ?)
  `);

  for (const learningPath of store.learningPaths ?? []) {
    insertLearningPath.run(
      learningPath.id,
      learningPath.technologyId,
      learningPath.updatedAt,
      JSON.stringify(learningPath)
    );
  }
}
