import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { knowledgeItems } from "@/data/knowledge";
import { skillItems } from "@/data/skills";
import { technologyItems } from "@/data/technologies";
import { getLocalDataDirPath } from "@/lib/local-data";
import type {
  DailyDigest,
  DeliveryChannel,
  DeliveryRun,
  DuplicateGroup,
  EditorialEnrichmentSuggestion,
  ExternalSource,
  ImportRun,
  ImportedCandidate,
  ImportedCandidateSourceRecord,
  ImportedCandidateSnapshot,
  KnowledgeItem,
  PromptVersion,
  ScheduledDelivery,
  ScheduledDeliveryRun,
  SkillItem,
  TaskRunnerRun,
  TechnologyItem,
  TechnologyWorkspaceRecord,
  WorkflowEvent
} from "@/types/content";

type SqlitePrimitive = string | number | null;

interface SqliteStatement {
  all(...values: SqlitePrimitive[]): Record<string, unknown>[];
  get(...values: SqlitePrimitive[]): Record<string, unknown> | undefined;
  run(...values: SqlitePrimitive[]): unknown;
}

interface SqliteDatabase {
  close(): void;
  exec(sql: string): void;
  prepare(sql: string): SqliteStatement;
}

interface SqliteConstructor {
  new (location: string): SqliteDatabase;
}

interface SqliteStoreMigrationSummary {
  sources: number;
  candidates: number;
  duplicateGroups: number;
  technologyDrafts: number;
  technologies: number;
  digests: number;
  deliveryLogs: number;
  workflowEvents: number;
  editorialEnrichmentSuggestions: number;
  promptVersions: number;
  skipped: number;
  errors: number;
}

interface SqliteSchemaStats {
  tableName: string;
  rowCount: number;
}

interface CandidateReviewStateEntry {
  importStatus: string;
  reviewedAt?: string;
  convertedTechnologyId?: string;
}

interface CandidateReviewStateFile {
  updatedAt: string;
  items: Record<string, CandidateReviewStateEntry>;
}

interface TechnologyWorkspaceStore {
  updatedAt: string;
  records: TechnologyWorkspaceRecord[];
}

interface DuplicateGroupStore {
  updatedAt: string;
  groups: DuplicateGroup[];
}

interface ExternalSourceStore {
  updatedAt: string;
  sources: ExternalSource[];
  latestImportRun?: ImportRun;
  importRuns?: ImportRun[];
}

interface DailyDigestStore {
  updatedAt: string;
  digests: DailyDigest[];
}

interface DeliveryStore {
  updatedAt: string;
  channels: DeliveryChannel[];
  runs: DeliveryRun[];
}

interface ScheduledDeliveryStore {
  updatedAt: string;
  schedules: ScheduledDelivery[];
  runs: ScheduledDeliveryRun[];
}

interface TaskRunnerStore {
  updatedAt: string;
  runs: TaskRunnerRun[];
}

interface WorkflowEventStore {
  updatedAt: string;
  events: WorkflowEvent[];
}

interface EditorialEnrichmentSuggestionStore {
  updatedAt: string;
  suggestions: EditorialEnrichmentSuggestion[];
}

interface PromptVersionStore {
  updatedAt: string;
  promptVersions: PromptVersion[];
}

const sqliteRequire = createRequire(__filename);

export const sqliteStoreFileName = "ai-tech-radar.sqlite";

const schemaTableNames = [
  "sources",
  "import_runs",
  "import_run_source_results",
  "imported_candidate_sources",
  "imported_candidates",
  "candidate_review_states",
  "duplicate_groups",
  "technology_drafts",
  "technologies",
  "knowledge_items",
  "skill_items",
  "daily_digests",
  "delivery_channels",
  "delivery_logs",
  "scheduled_deliveries",
  "scheduled_delivery_runs",
  "task_runs",
  "workflow_events",
  "editorial_enrichment_suggestions",
  "prompt_versions"
] as const;

function getTimestamp(): string {
  return new Date().toISOString();
}

export function getPersistenceDriver(): "json" | "sqlite" {
  return process.env.PERSISTENCE_DRIVER === "sqlite" ? "sqlite" : "json";
}

export function getSqliteDatabasePath(): string {
  const configuredPath = process.env.SQLITE_DATABASE_PATH?.trim();

  if (configuredPath) {
    return path.isAbsolute(configuredPath)
      ? configuredPath
      : path.join(process.cwd(), configuredPath);
  }

  return path.join(getLocalDataDirPath(), sqliteStoreFileName);
}

export function openSqliteDatabase(): SqliteDatabase {
  const databasePath = getSqliteDatabasePath();
  const { DatabaseSync } = sqliteRequire("node:sqlite") as {
    DatabaseSync: SqliteConstructor;
  };

  mkdirSync(path.dirname(databasePath), { recursive: true });

  const database = new DatabaseSync(databasePath);

  database.exec("PRAGMA foreign_keys = ON;");
  initializeSqliteSchema(database);

  return database;
}

export function initializeSqliteDatabase(): SqliteSchemaStats[] {
  const database = openSqliteDatabase();

  try {
    seedStaticContent(database);

    return getSqliteSchemaStats(database);
  } finally {
    database.close();
  }
}

export function resetSqliteDatabase(): void {
  const databasePath = getSqliteDatabasePath();

  if (existsSync(databasePath)) {
    unlinkSync(databasePath);
  }

  initializeSqliteDatabase();
}

export function getSqliteSchemaStats(database = openSqliteDatabase()): SqliteSchemaStats[] {
  const shouldClose = arguments.length === 0;

  try {
    return schemaTableNames.map((tableName) => {
      const row = database
        .prepare(`SELECT COUNT(*) AS rowCount FROM ${tableName}`)
        .get();

      return {
        tableName,
        rowCount: Number(row?.rowCount ?? 0)
      };
    });
  } finally {
    if (shouldClose) {
      database.close();
    }
  }
}

export function readSqliteJsonStore<T>(
  fileName: string,
  fallbackValue: T
): T {
  const database = openSqliteDatabase();

  try {
    switch (fileName) {
      case "external-sources.json":
        return readExternalSourceStore(database) as T;
      case "imported-candidates.live.json":
        return readImportedCandidateSnapshot(database) as T;
      case "candidate-review-state.json":
        return readCandidateReviewState(database) as T;
      case "duplicate-groups.json":
        return readDuplicateGroupStore(database) as T;
      case "technology-workspace.json":
        return readTechnologyWorkspaceStore(database) as T;
      case "daily-digests.json":
        return readDailyDigestStore(database) as T;
      case "delivery.json":
        return readDeliveryStore(database) as T;
      case "scheduled-delivery.json":
        return readScheduledDeliveryStore(database) as T;
      case "task-runner.json":
        return readTaskRunnerStore(database) as T;
      case "workflow-events.json":
        return readWorkflowEventStore(database) as T;
      case "editorial-enrichment-suggestions.json":
        return readEditorialEnrichmentSuggestionStore(database) as T;
      case "prompt-versions.json":
        return readPromptVersionStore(database) as T;
      default:
        return fallbackValue;
    }
  } finally {
    database.close();
  }
}

export function writeSqliteJsonStore(fileName: string, value: unknown): void {
  const database = openSqliteDatabase();

  try {
    runSqliteTransaction(database, () => {
      switch (fileName) {
        case "external-sources.json":
          writeExternalSourceStore(database, value as ExternalSourceStore);
          break;
        case "imported-candidates.live.json":
          writeImportedCandidateSnapshot(
            database,
            value as ImportedCandidateSnapshot
          );
          break;
        case "candidate-review-state.json":
          writeCandidateReviewState(database, value as CandidateReviewStateFile);
          break;
        case "duplicate-groups.json":
          writeDuplicateGroupStore(database, value as DuplicateGroupStore);
          break;
        case "technology-workspace.json":
          writeTechnologyWorkspaceStore(database, value as TechnologyWorkspaceStore);
          break;
        case "daily-digests.json":
          writeDailyDigestStore(database, value as DailyDigestStore);
          break;
        case "delivery.json":
          writeDeliveryStore(database, value as DeliveryStore);
          break;
        case "scheduled-delivery.json":
          writeScheduledDeliveryStore(database, value as ScheduledDeliveryStore);
          break;
        case "task-runner.json":
          writeTaskRunnerStore(database, value as TaskRunnerStore);
          break;
        case "workflow-events.json":
          writeWorkflowEventStore(database, value as WorkflowEventStore);
          break;
        case "editorial-enrichment-suggestions.json":
          writeEditorialEnrichmentSuggestionStore(
            database,
            value as EditorialEnrichmentSuggestionStore
          );
          break;
        case "prompt-versions.json":
          writePromptVersionStore(database, value as PromptVersionStore);
          break;
        default:
          throw new Error(`No SQLite adapter exists for ${fileName}.`);
      }
    });
  } finally {
    database.close();
  }
}

export function migrateJsonStoresToSqlite(stores: {
  externalSources: ExternalSourceStore;
  importedCandidates: ImportedCandidateSnapshot;
  candidateReviewState: CandidateReviewStateFile;
  duplicateGroups: DuplicateGroupStore;
  technologyWorkspace: TechnologyWorkspaceStore;
  dailyDigests: DailyDigestStore;
  delivery: DeliveryStore;
  scheduledDelivery: ScheduledDeliveryStore;
  taskRunner: TaskRunnerStore;
  workflowEvents?: WorkflowEventStore;
  editorialEnrichmentSuggestions?: EditorialEnrichmentSuggestionStore;
  promptVersions?: PromptVersionStore;
}): SqliteStoreMigrationSummary {
  const database = openSqliteDatabase();
  const summary: SqliteStoreMigrationSummary = {
    sources: 0,
    candidates: 0,
    duplicateGroups: 0,
    technologyDrafts: 0,
    technologies: 0,
    digests: 0,
    deliveryLogs: 0,
    workflowEvents: 0,
    editorialEnrichmentSuggestions: 0,
    promptVersions: 0,
    skipped: 0,
    errors: 0
  };

  try {
    runSqliteTransaction(database, () => {
      writeExternalSourceStore(database, stores.externalSources);
      writeImportedCandidateSnapshot(database, stores.importedCandidates);
      writeCandidateReviewState(database, stores.candidateReviewState);
      writeDuplicateGroupStore(database, stores.duplicateGroups);
      writeTechnologyWorkspaceStore(database, stores.technologyWorkspace);
      writeDailyDigestStore(database, stores.dailyDigests);
      writeDeliveryStore(database, stores.delivery);
      writeScheduledDeliveryStore(database, stores.scheduledDelivery);
      writeTaskRunnerStore(database, stores.taskRunner);
      writeWorkflowEventStore(
        database,
        stores.workflowEvents ?? { updatedAt: getTimestamp(), events: [] }
      );
      writeEditorialEnrichmentSuggestionStore(
        database,
        stores.editorialEnrichmentSuggestions ?? {
          updatedAt: getTimestamp(),
          suggestions: []
        }
      );
      writePromptVersionStore(
        database,
        stores.promptVersions ?? { updatedAt: getTimestamp(), promptVersions: [] }
      );
      seedStaticContent(database);
    });

    summary.sources = getTableCount(database, "sources");
    summary.candidates = getTableCount(database, "imported_candidates");
    summary.duplicateGroups = getTableCount(database, "duplicate_groups");
    summary.technologyDrafts = getTableCount(database, "technology_drafts");
    summary.technologies = getTableCount(database, "technologies");
    summary.digests = getTableCount(database, "daily_digests");
    summary.deliveryLogs = getTableCount(database, "delivery_logs");
    summary.workflowEvents = getTableCount(database, "workflow_events");
    summary.editorialEnrichmentSuggestions = getTableCount(
      database,
      "editorial_enrichment_suggestions"
    );
    summary.promptVersions = getTableCount(database, "prompt_versions");

    return summary;
  } catch {
    summary.errors += 1;

    return summary;
  } finally {
    database.close();
  }
}

function initializeSqliteSchema(database: SqliteDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      status TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_sources_url ON sources(url);
    CREATE INDEX IF NOT EXISTS idx_sources_enabled_type ON sources(enabled, type);

    CREATE TABLE IF NOT EXISTS import_runs (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_import_runs_startedAt ON import_runs(startedAt);

    CREATE TABLE IF NOT EXISTS import_run_source_results (
      importRunId TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (importRunId, sourceId),
      FOREIGN KEY (importRunId) REFERENCES import_runs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS imported_candidate_sources (
      id TEXT PRIMARY KEY,
      sourceType TEXT NOT NULL,
      sourceUrl TEXT NOT NULL,
      fetchedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS imported_candidates (
      id TEXT PRIMARY KEY,
      sourceId TEXT,
      sourceUrl TEXT NOT NULL,
      importStatus TEXT NOT NULL,
      duplicateGroupId TEXT,
      convertedTechnologyId TEXT,
      publishDate TEXT,
      importedAt TEXT,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_imported_candidates_sourceId ON imported_candidates(sourceId);
    CREATE INDEX IF NOT EXISTS idx_imported_candidates_sourceUrl ON imported_candidates(sourceUrl);
    CREATE INDEX IF NOT EXISTS idx_imported_candidates_status ON imported_candidates(importStatus);

    CREATE TABLE IF NOT EXISTS candidate_review_states (
      candidateId TEXT PRIMARY KEY,
      importStatus TEXT NOT NULL,
      reviewedAt TEXT,
      convertedTechnologyId TEXT,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS duplicate_groups (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      primaryCandidateId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_duplicate_groups_status ON duplicate_groups(status);

    CREATE TABLE IF NOT EXISTS technology_drafts (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      status TEXT NOT NULL,
      sourceCandidateId TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_technology_drafts_status ON technology_drafts(status);
    CREATE INDEX IF NOT EXISTS idx_technology_drafts_slug ON technology_drafts(slug);

    CREATE TABLE IF NOT EXISTS technologies (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      status TEXT NOT NULL,
      publishDate TEXT NOT NULL,
      recordKind TEXT NOT NULL DEFAULT 'workspace',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_technologies_slug_kind ON technologies(slug, recordKind);
    CREATE INDEX IF NOT EXISTS idx_technologies_status_publishDate ON technologies(status, publishDate);

    CREATE TABLE IF NOT EXISTS knowledge_items (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_items (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL,
      payload TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_digests (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      generatedAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      publishedAt TEXT,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_daily_digests_status_date ON daily_digests(status, date);

    CREATE TABLE IF NOT EXISTS delivery_channels (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      lastDeliveryStatus TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_delivery_channels_type_enabled ON delivery_channels(type, enabled);

    CREATE TABLE IF NOT EXISTS delivery_logs (
      id TEXT PRIMARY KEY,
      digestId TEXT NOT NULL,
      digestDate TEXT NOT NULL,
      channelId TEXT NOT NULL,
      status TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      retryOfDeliveryRunId TEXT,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_delivery_logs_digest_channel ON delivery_logs(digestDate, channelId);
    CREATE INDEX IF NOT EXISTS idx_delivery_logs_status_startedAt ON delivery_logs(status, startedAt);

    CREATE TABLE IF NOT EXISTS scheduled_deliveries (
      id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL,
      digestTarget TEXT NOT NULL,
      nextRunAt TEXT,
      lastRunStatus TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_enabled_nextRunAt ON scheduled_deliveries(enabled, nextRunAt);

    CREATE TABLE IF NOT EXISTS scheduled_delivery_runs (
      id TEXT PRIMARY KEY,
      scheduleId TEXT NOT NULL,
      digestId TEXT,
      digestDate TEXT,
      status TEXT NOT NULL,
      triggerType TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_scheduled_delivery_runs_schedule_startedAt ON scheduled_delivery_runs(scheduleId, startedAt);

    CREATE TABLE IF NOT EXISTS task_runs (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      startedAt TEXT NOT NULL,
      finishedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_task_runs_startedAt_status ON task_runs(startedAt, status);

    CREATE TABLE IF NOT EXISTS workflow_events (
      id TEXT PRIMARY KEY,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      action TEXT NOT NULL,
      actorType TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_workflow_events_entity_createdAt ON workflow_events(entityType, entityId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_workflow_events_action_createdAt ON workflow_events(action, createdAt);

    CREATE TABLE IF NOT EXISTS editorial_enrichment_suggestions (
      id TEXT PRIMARY KEY,
      technologyDraftId TEXT NOT NULL,
      status TEXT NOT NULL,
      generationMode TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_editorial_enrichment_draft_status ON editorial_enrichment_suggestions(technologyDraftId, status);
    CREATE INDEX IF NOT EXISTS idx_editorial_enrichment_updatedAt ON editorial_enrichment_suggestions(updatedAt);

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      purpose TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_prompt_versions_purpose_status ON prompt_versions(purpose, status);
  `);
}

function runSqliteTransaction(database: SqliteDatabase, action: () => void): void {
  database.exec("BEGIN IMMEDIATE;");

  try {
    action();
    database.exec("COMMIT;");
  } catch (error) {
    database.exec("ROLLBACK;");
    throw error;
  }
}

function parsePayload<T>(row: Record<string, unknown>): T {
  return JSON.parse(String(row.payload)) as T;
}

function getTableCount(database: SqliteDatabase, tableName: string): number {
  const row = database
    .prepare(`SELECT COUNT(*) AS rowCount FROM ${tableName}`)
    .get();

  return Number(row?.rowCount ?? 0);
}

function selectPayloads<T>(
  database: SqliteDatabase,
  sql: string,
  ...values: SqlitePrimitive[]
): T[] {
  return database.prepare(sql).all(...values).map(parsePayload<T>);
}

function seedStaticContent(database: SqliteDatabase): void {
  const insertTechnology = database.prepare(`
    INSERT OR REPLACE INTO technologies (
      id, slug, status, publishDate, recordKind, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, 'seed', ?, ?, ?)
  `);
  const insertKnowledge = database.prepare(`
    INSERT OR REPLACE INTO knowledge_items (id, slug, payload)
    VALUES (?, ?, ?)
  `);
  const insertSkill = database.prepare(`
    INSERT OR REPLACE INTO skill_items (id, slug, payload)
    VALUES (?, ?, ?)
  `);
  const now = getTimestamp();

  for (const technology of technologyItems) {
    insertTechnology.run(
      technology.id,
      technology.slug,
      technology.status,
      technology.publishDate,
      now,
      now,
      JSON.stringify(technology)
    );
  }

  for (const knowledge of knowledgeItems) {
    insertKnowledge.run(knowledge.id, knowledge.slug, JSON.stringify(knowledge));
  }

  for (const skill of skillItems) {
    insertSkill.run(skill.id, skill.slug, JSON.stringify(skill));
  }
}

function clearTables(database: SqliteDatabase, tableNames: string[]): void {
  for (const tableName of tableNames) {
    database.prepare(`DELETE FROM ${tableName}`).run();
  }
}

function readExternalSourceStore(database: SqliteDatabase): ExternalSourceStore {
  const sources = selectPayloads<ExternalSource>(
    database,
    "SELECT payload FROM sources ORDER BY name ASC"
  );
  const importRuns = selectPayloads<ImportRun>(
    database,
    "SELECT payload FROM import_runs ORDER BY startedAt DESC"
  );

  return {
    updatedAt: getTimestamp(),
    sources,
    latestImportRun: importRuns[0],
    importRuns
  };
}

function writeExternalSourceStore(
  database: SqliteDatabase,
  store: ExternalSourceStore
): void {
  clearTables(database, ["import_run_source_results", "import_runs", "sources"]);

  const insertSource = database.prepare(`
    INSERT OR REPLACE INTO sources (
      id, name, type, url, enabled, status, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRun = database.prepare(`
    INSERT OR REPLACE INTO import_runs (
      id, status, startedAt, finishedAt, payload
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertRunResult = database.prepare(`
    INSERT OR REPLACE INTO import_run_source_results (
      importRunId, sourceId, status, payload
    ) VALUES (?, ?, ?, ?)
  `);

  for (const source of store.sources ?? []) {
    insertSource.run(
      source.id,
      source.name,
      source.type,
      source.url,
      source.enabled ? 1 : 0,
      source.lastImportStatus,
      source.createdAt,
      source.updatedAt,
      JSON.stringify(source)
    );
  }

  for (const run of store.importRuns ?? []) {
    insertRun.run(
      run.id,
      run.status,
      run.startedAt,
      run.finishedAt,
      JSON.stringify(run)
    );

    for (const result of run.sourceResults ?? []) {
      insertRunResult.run(
        run.id,
        result.sourceId,
        result.status,
        JSON.stringify(result)
      );
    }
  }
}

function readImportedCandidateSnapshot(
  database: SqliteDatabase
): ImportedCandidateSnapshot {
  return {
    syncedAt: getTimestamp(),
    sources: selectPayloads<ImportedCandidateSourceRecord>(
      database,
      "SELECT payload FROM imported_candidate_sources ORDER BY fetchedAt DESC"
    ),
    candidates: selectPayloads<ImportedCandidate>(
      database,
      "SELECT payload FROM imported_candidates ORDER BY publishDate DESC, id ASC"
    )
  };
}

function writeImportedCandidateSnapshot(
  database: SqliteDatabase,
  snapshot: ImportedCandidateSnapshot
): void {
  clearTables(database, ["imported_candidate_sources", "imported_candidates"]);

  const insertSource = database.prepare(`
    INSERT OR REPLACE INTO imported_candidate_sources (
      id, sourceType, sourceUrl, fetchedAt, payload
    ) VALUES (?, ?, ?, ?, ?)
  `);
  const insertCandidate = database.prepare(`
    INSERT OR REPLACE INTO imported_candidates (
      id, sourceId, sourceUrl, importStatus, duplicateGroupId,
      convertedTechnologyId, publishDate, importedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const source of snapshot.sources ?? []) {
    insertSource.run(
      source.id,
      source.sourceType,
      source.sourceUrl,
      source.fetchedAt,
      JSON.stringify(source)
    );
  }

  for (const candidate of snapshot.candidates ?? []) {
    insertCandidate.run(
      candidate.id,
      candidate.sourceId ?? null,
      candidate.sourceUrl,
      candidate.importStatus,
      candidate.duplicateGroupId ?? null,
      candidate.convertedTechnologyId ?? null,
      candidate.publishDate,
      candidate.importedAt ?? null,
      JSON.stringify(candidate)
    );
  }
}

function readCandidateReviewState(database: SqliteDatabase): CandidateReviewStateFile {
  const entries = selectPayloads<CandidateReviewStateEntry & { candidateId: string }>(
    database,
    "SELECT payload FROM candidate_review_states ORDER BY candidateId ASC"
  );

  return {
    updatedAt: getTimestamp(),
    items: Object.fromEntries(
      entries.map((entry) => {
        const { candidateId, ...state } = entry;

        return [candidateId, state];
      })
    )
  };
}

function writeCandidateReviewState(
  database: SqliteDatabase,
  state: CandidateReviewStateFile
): void {
  clearTables(database, ["candidate_review_states"]);

  const insertState = database.prepare(`
    INSERT OR REPLACE INTO candidate_review_states (
      candidateId, importStatus, reviewedAt, convertedTechnologyId, payload
    ) VALUES (?, ?, ?, ?, ?)
  `);

  for (const [candidateId, entry] of Object.entries(state.items ?? {})) {
    insertState.run(
      candidateId,
      entry.importStatus,
      entry.reviewedAt ?? null,
      entry.convertedTechnologyId ?? null,
      JSON.stringify({ candidateId, ...entry })
    );
  }
}

function readDuplicateGroupStore(database: SqliteDatabase): DuplicateGroupStore {
  return {
    updatedAt: getTimestamp(),
    groups: selectPayloads<DuplicateGroup>(
      database,
      "SELECT payload FROM duplicate_groups ORDER BY updatedAt DESC"
    )
  };
}

function writeDuplicateGroupStore(
  database: SqliteDatabase,
  store: DuplicateGroupStore
): void {
  clearTables(database, ["duplicate_groups"]);

  const insertGroup = database.prepare(`
    INSERT OR REPLACE INTO duplicate_groups (
      id, status, primaryCandidateId, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const group of store.groups ?? []) {
    insertGroup.run(
      group.id,
      group.status,
      group.primaryCandidateId,
      group.createdAt,
      group.updatedAt,
      JSON.stringify(group)
    );
  }
}

function readTechnologyWorkspaceStore(
  database: SqliteDatabase
): TechnologyWorkspaceStore {
  const drafts = selectPayloads<TechnologyWorkspaceRecord>(
    database,
    "SELECT payload FROM technology_drafts ORDER BY updatedAt DESC"
  );
  const publishedWorkspaceRecords = selectPayloads<TechnologyWorkspaceRecord>(
    database,
    "SELECT payload FROM technologies WHERE recordKind = 'workspace' ORDER BY updatedAt DESC"
  );

  return {
    updatedAt: getTimestamp(),
    records: [...drafts, ...publishedWorkspaceRecords]
  };
}

function writeTechnologyWorkspaceStore(
  database: SqliteDatabase,
  store: TechnologyWorkspaceStore
): void {
  database.prepare("DELETE FROM technology_drafts").run();
  database.prepare("DELETE FROM technologies WHERE recordKind = 'workspace'").run();

  const insertDraft = database.prepare(`
    INSERT OR REPLACE INTO technology_drafts (
      id, slug, status, sourceCandidateId, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTechnology = database.prepare(`
    INSERT OR REPLACE INTO technologies (
      id, slug, status, publishDate, recordKind, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, 'workspace', ?, ?, ?)
  `);

  for (const record of store.records ?? []) {
    if (record.status === "published") {
      insertTechnology.run(
        record.id,
        record.slug,
        record.status,
        record.publishDate,
        record.createdAt,
        record.updatedAt,
        JSON.stringify(record)
      );
    } else {
      insertDraft.run(
        record.id,
        record.slug,
        record.status,
        record.sourceCandidateId ?? null,
        record.createdAt,
        record.updatedAt,
        JSON.stringify(record)
      );
    }
  }
}

function readDailyDigestStore(database: SqliteDatabase): DailyDigestStore {
  return {
    updatedAt: getTimestamp(),
    digests: selectPayloads<DailyDigest>(
      database,
      "SELECT payload FROM daily_digests ORDER BY date DESC"
    )
  };
}

function writeDailyDigestStore(database: SqliteDatabase, store: DailyDigestStore): void {
  clearTables(database, ["daily_digests"]);

  const insertDigest = database.prepare(`
    INSERT OR REPLACE INTO daily_digests (
      id, date, status, generatedAt, updatedAt, publishedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const digest of store.digests ?? []) {
    insertDigest.run(
      digest.id,
      digest.date,
      digest.status,
      digest.generatedAt,
      digest.updatedAt,
      digest.publishedAt ?? null,
      JSON.stringify(digest)
    );
  }
}

function readDeliveryStore(database: SqliteDatabase): DeliveryStore {
  return {
    updatedAt: getTimestamp(),
    channels: selectPayloads<DeliveryChannel>(
      database,
      "SELECT payload FROM delivery_channels ORDER BY id ASC"
    ),
    runs: selectPayloads<DeliveryRun>(
      database,
      "SELECT payload FROM delivery_logs ORDER BY startedAt DESC"
    )
  };
}

function writeDeliveryStore(database: SqliteDatabase, store: DeliveryStore): void {
  clearTables(database, ["delivery_logs", "delivery_channels"]);

  const insertChannel = database.prepare(`
    INSERT OR REPLACE INTO delivery_channels (
      id, type, enabled, lastDeliveryStatus, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRun = database.prepare(`
    INSERT OR REPLACE INTO delivery_logs (
      id, digestId, digestDate, channelId, status, startedAt, finishedAt,
      retryOfDeliveryRunId, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const channel of store.channels ?? []) {
    insertChannel.run(
      channel.id,
      channel.type,
      channel.enabled ? 1 : 0,
      channel.lastDeliveryStatus ?? null,
      channel.createdAt,
      channel.updatedAt,
      JSON.stringify(channel)
    );
  }

  for (const run of store.runs ?? []) {
    insertRun.run(
      run.id,
      run.digestId,
      run.digestDate,
      run.channelId,
      run.status,
      run.startedAt,
      run.finishedAt ?? null,
      run.retryOfDeliveryRunId ?? null,
      JSON.stringify(run)
    );
  }
}

function readScheduledDeliveryStore(
  database: SqliteDatabase
): ScheduledDeliveryStore {
  return {
    updatedAt: getTimestamp(),
    schedules: selectPayloads<ScheduledDelivery>(
      database,
      "SELECT payload FROM scheduled_deliveries ORDER BY id ASC"
    ),
    runs: selectPayloads<ScheduledDeliveryRun>(
      database,
      "SELECT payload FROM scheduled_delivery_runs ORDER BY startedAt DESC"
    )
  };
}

function writeScheduledDeliveryStore(
  database: SqliteDatabase,
  store: ScheduledDeliveryStore
): void {
  clearTables(database, ["scheduled_delivery_runs", "scheduled_deliveries"]);

  const insertSchedule = database.prepare(`
    INSERT OR REPLACE INTO scheduled_deliveries (
      id, enabled, digestTarget, nextRunAt, lastRunStatus, createdAt, updatedAt,
      payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRun = database.prepare(`
    INSERT OR REPLACE INTO scheduled_delivery_runs (
      id, scheduleId, digestId, digestDate, status, triggerType, startedAt,
      finishedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const schedule of store.schedules ?? []) {
    insertSchedule.run(
      schedule.id,
      schedule.enabled ? 1 : 0,
      schedule.digestTarget,
      schedule.nextRunAt ?? null,
      schedule.lastRunStatus,
      schedule.createdAt,
      schedule.updatedAt,
      JSON.stringify(schedule)
    );
  }

  for (const run of store.runs ?? []) {
    insertRun.run(
      run.id,
      run.scheduleId,
      run.digestId ?? null,
      run.digestDate ?? null,
      run.status,
      run.triggerType,
      run.startedAt,
      run.finishedAt ?? null,
      JSON.stringify(run)
    );
  }
}

function readTaskRunnerStore(database: SqliteDatabase): TaskRunnerStore {
  return {
    updatedAt: getTimestamp(),
    runs: selectPayloads<TaskRunnerRun>(
      database,
      "SELECT payload FROM task_runs ORDER BY startedAt DESC"
    )
  };
}

function writeTaskRunnerStore(database: SqliteDatabase, store: TaskRunnerStore): void {
  clearTables(database, ["task_runs"]);

  const insertRun = database.prepare(`
    INSERT OR REPLACE INTO task_runs (
      id, mode, status, startedAt, finishedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const run of store.runs ?? []) {
    insertRun.run(
      run.id,
      run.mode,
      run.status,
      run.startedAt,
      run.finishedAt,
      JSON.stringify(run)
    );
  }
}

function readWorkflowEventStore(database: SqliteDatabase): WorkflowEventStore {
  return {
    updatedAt: getTimestamp(),
    events: selectPayloads<WorkflowEvent>(
      database,
      "SELECT payload FROM workflow_events ORDER BY createdAt DESC"
    )
  };
}

function writeWorkflowEventStore(
  database: SqliteDatabase,
  store: WorkflowEventStore
): void {
  clearTables(database, ["workflow_events"]);

  const insertEvent = database.prepare(`
    INSERT OR REPLACE INTO workflow_events (
      id, entityType, entityId, action, actorType, createdAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const event of store.events ?? []) {
    insertEvent.run(
      event.id,
      event.entityType,
      event.entityId,
      event.action,
      event.actorType,
      event.createdAt,
      JSON.stringify(event)
    );
  }
}

function readEditorialEnrichmentSuggestionStore(
  database: SqliteDatabase
): EditorialEnrichmentSuggestionStore {
  return {
    updatedAt: getTimestamp(),
    suggestions: selectPayloads<EditorialEnrichmentSuggestion>(
      database,
      "SELECT payload FROM editorial_enrichment_suggestions ORDER BY createdAt DESC"
    )
  };
}

function writeEditorialEnrichmentSuggestionStore(
  database: SqliteDatabase,
  store: EditorialEnrichmentSuggestionStore
): void {
  clearTables(database, ["editorial_enrichment_suggestions"]);

  const insertSuggestion = database.prepare(`
    INSERT OR REPLACE INTO editorial_enrichment_suggestions (
      id, technologyDraftId, status, generationMode, createdAt, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const suggestion of store.suggestions ?? []) {
    insertSuggestion.run(
      suggestion.id,
      suggestion.technologyDraftId,
      suggestion.status,
      suggestion.generationMode,
      suggestion.createdAt,
      suggestion.updatedAt,
      JSON.stringify(suggestion)
    );
  }
}

function readPromptVersionStore(database: SqliteDatabase): PromptVersionStore {
  return {
    updatedAt: getTimestamp(),
    promptVersions: selectPayloads<PromptVersion>(
      database,
      "SELECT payload FROM prompt_versions ORDER BY updatedAt DESC"
    )
  };
}

function writePromptVersionStore(
  database: SqliteDatabase,
  store: PromptVersionStore
): void {
  clearTables(database, ["prompt_versions"]);

  const insertPromptVersion = database.prepare(`
    INSERT OR REPLACE INTO prompt_versions (
      id, purpose, version, status, updatedAt, payload
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const promptVersion of store.promptVersions ?? []) {
    insertPromptVersion.run(
      promptVersion.id,
      promptVersion.purpose,
      promptVersion.version,
      promptVersion.status,
      promptVersion.updatedAt,
      JSON.stringify(promptVersion)
    );
  }
}

export function readSqliteKnowledgeItems(): KnowledgeItem[] {
  const database = openSqliteDatabase();

  try {
    return selectPayloads<KnowledgeItem>(
      database,
      "SELECT payload FROM knowledge_items ORDER BY id ASC"
    );
  } finally {
    database.close();
  }
}

export function readSqliteSkillItems(): SkillItem[] {
  const database = openSqliteDatabase();

  try {
    return selectPayloads<SkillItem>(
      database,
      "SELECT payload FROM skill_items ORDER BY id ASC"
    );
  } finally {
    database.close();
  }
}

export function readSqliteSeedTechnologies(): TechnologyItem[] {
  const database = openSqliteDatabase();

  try {
    return selectPayloads<TechnologyItem>(
      database,
      "SELECT payload FROM technologies WHERE recordKind = 'seed' ORDER BY publishDate DESC"
    );
  } finally {
    database.close();
  }
}
