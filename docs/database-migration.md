# Database Migration v0

Database Migration v0 adds an optional SQLite persistence driver while keeping the existing local JSON workflow as the safe default.

This is not a production database migration. It is a local-first persistence layer that proves the repository boundary, schema shape, and JSON-to-database migration path.

## Driver Modes

Supported persistence drivers:

- `PERSISTENCE_DRIVER=json`: default mode. Workflow state is read from local JSON files under `LOCAL_DATA_DIR`.
- `PERSISTENCE_DRIVER=sqlite`: workflow stores are read from and written to SQLite through `src/lib/repositories/sqlite-store.ts`.

The JSON driver remains in place as fallback and backup. The SQLite driver is optional so local development does not break if no database has been initialized.

## SQLite Location

Default path:

```bash
./config/ai-tech-radar.sqlite
```

Override with:

```bash
SQLITE_DATABASE_PATH=./config/ai-tech-radar.sqlite
```

The implementation uses Node's built-in `node:sqlite` module in Node 24. This avoids adding Prisma, Drizzle, SQLite native packages, or other dependencies in this v0.

## Commands

Initialize schema and seed static user-facing content:

```bash
npm run db:init
```

Migrate current local JSON workflow state into SQLite:

```bash
npm run db:migrate-json
```

Reset the local SQLite database:

```bash
ALLOW_DB_RESET=true npm run db:reset
```

`db:reset` refuses to delete data unless `ALLOW_DB_RESET=true` is set.

Validate schema, migration, references, driver switching, and public-data isolation:

```bash
npm run validate:database
```

## Schema v0

SQLite tables created in v0:

- `sources`
- `import_runs`
- `import_run_source_results`
- `imported_candidate_sources`
- `imported_candidates`
- `candidate_review_states`
- `duplicate_groups`
- `technology_drafts`
- `technologies`
- `knowledge_items`
- `skill_items`
- `daily_digests`
- `delivery_channels`
- `delivery_logs`
- `scheduled_deliveries`
- `scheduled_delivery_runs`
- `task_runs`
- `workflow_events`
- `editorial_enrichment_suggestions`
- `prompt_versions`

The schema intentionally stores each domain record as a JSON payload plus key query columns such as `id`, `status`, `slug`, `sourceId`, `sourceUrl`, `publishDate`, `enabled`, `createdAt`, and `updatedAt`.

This avoids over-normalizing the prototype while still making the future Postgres/Supabase migration path clear.

## Repository Boundary

Current repository files:

- `src/lib/repositories/local-json-store.ts`
- `src/lib/repositories/sqlite-store.ts`

Workflow modules still own business behavior:

- `source-workflow.ts`
- `candidate-workflow.ts`
- `technology-draft-workflow.ts`
- `digest-workflow.ts`
- `delivery-workflow.ts`
- `scheduled-delivery-workflow.ts`
- `task-runner.ts`

Pages and API routes continue calling workflow modules. They do not write SQL directly.

## Migration Behavior

`npm run db:migrate-json` reads the existing JSON files and writes SQLite rows:

- source configuration and import runs
- imported candidate snapshots and candidate source snapshots
- candidate review state
- duplicate groups
- technology workspace drafts and published workspace records
- daily digests
- delivery channels and delivery logs
- scheduled deliveries and schedule runs
- task-runner audit summaries
- workflow event audit logs
- editorial enrichment suggestions
- prompt versions

It preserves existing object IDs and relationships. It does not delete or rewrite the original JSON files.

## Workflow Hardening v1

SQLite writes are wrapped in per-store transactions. This protects each store replacement from partial table writes.

Database-backed Workflow Hardening v1 adds a lightweight `workflow_events` table and matching `workflow-events.json` fallback store. Editorial Enrichment v0 adds `editorial_enrichment_suggestions` with `editorial-enrichment-suggestions.json` fallback store. Prompt Quality v1 adds `prompt_versions` with `prompt-versions.json` fallback store. LLM Provider Integration v0 stores provider/model/prompt metadata, token usage, validation warnings, and generation errors only inside those internal suggestion payloads. These records remain internal and are not user-facing content.

`workflow_events` records key workflow state changes without adding users or RBAC:

- `candidate.converted_to_draft`
- `candidate.convert_failed`
- `duplicate_group.resolved`
- `draft.updated`
- `draft.published`
- `draft.publish_failed`
- `editorial_enrichment.generated`
- `editorial_enrichment.failed`
- `editorial_enrichment.applied`
- `editorial_enrichment.rejected`
- `editorial_enrichment.stale`
- `prompt_version.created`
- `enrichment_suggestion.generated`
- `enrichment_suggestion.reviewed`
- `enrichment_suggestion.applied`
- `enrichment_suggestion.rejected`
- `enrichment_suggestion.marked_stale`
- `digest.generated`
- `digest.updated`
- `digest.published`
- `digest.publish_failed`
- `delivery.sent`
- `delivery.failed`
- `schedule.run`
- `schedule.run_failed`
- `task_runner.run`
- `source.imported`

Workflow events are internal-only. They sanitize token-like and endpoint-like fields before storage and are shown only in workspace audit panels.

Additional hardening added in v1:

- repeated candidate conversion returns the existing draft instead of creating duplicate workspace records
- failed candidate conversion records a failure event
- if candidate review-state write fails after draft creation, the workflow attempts to restore the prior draft store before rethrowing
- publish failures record blocking readiness reason codes
- delivery failures still produce failed delivery logs and workflow events
- scheduled delivery continues to skip duplicate scheduled sends for the same schedule / digest / channel / local day

Full cross-store ACID transactions remain a follow-up item. These flows still need stronger database-native transaction boundaries before production:

- Candidate -> Technology draft plus candidate status update
- DuplicateGroup resolve plus primary conversion guard
- Draft -> Published TechnologyItem
- Digest generate / regenerate
- Digest publish
- Delivery run plus delivery logs
- Scheduled delivery run plus per-channel logs
- Source import plus candidate insertion plus source health update

## Current Migration Coverage

SQLite driver support has been added for the dynamic workflow stores used by:

- Source management
- Batch import and source health
- ImportedCandidate candidate pool
- Duplicate Review
- Candidate -> Technology draft
- Draft edit and publish
- Ranking / quality reads that depend on workflow data
- Daily Digest generation, editing, and publish state
- DeliveryChannel and DeliveryLog
- ScheduledDelivery and task runner state

Static seed technologies, knowledge items, and skill items are seeded into SQLite for validation and SQLite-mode reads. The TypeScript data files remain the fallback source for JSON mode.

## What Still Uses JSON

JSON mode still uses the original JSON files.

The following are intentionally not removed:

- `config/*.json`
- static seed content in `src/data/*`

The fallback exists so local workflows and existing validation scripts remain stable while SQLite adoption is tested.

## Not Production-Grade Yet

Still left for later:

- production-grade migrations
- Postgres/Supabase schema
- DB-backed locks
- full cross-workflow transactions
- encrypted secret storage
- concurrent editor conflict handling
- backup and restore process
- hosted deployment database provisioning
