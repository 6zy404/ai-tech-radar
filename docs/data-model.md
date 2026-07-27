# Data Model

This prototype now uses a clear split between internal workflow objects and user-facing content objects.

## ExternalSource

Represents a configured external source or source type.

- `id`
- `name`
- `type`: `rss | atom | github_release | official_blog`
- `url`
- `enabled`
- `description?`
- `language`
- `publisherName?`
- `publisherType`
- `defaultTags`
- `defaultNormalizedType`
- `lastFetchedAt?`
- `lastImportStatus`: `never_run | success | failed | partial`
- `lastImportMessage?`
- `lastImportCount?`
- `lastErrorMessage?`
- `consecutiveFailureCount?`
- `totalImportedCount?`
- `lastSuccessfulImportAt?`
- `createdAt`
- `updatedAt`
- `maxItems?`

Used by the source management UI and live importer layer. This is internal workflow structure, not user-facing content.

The health fields describe the latest observable import state for that source. `partial` means the live import failed but a local fallback candidate was used, so the workflow remains inspectable without pretending the source is healthy.

## SourceQualityMetrics

Computed Internal Workspace metrics for a source. These are not persisted onto `TechnologyItem` and are not user-facing ranking fields.

- `successRate`
- `totalImportRuns`
- `successfulImportRuns`
- `failedImportRuns`
- `totalCandidatesImported`
- `convertedCandidateCount`
- `rejectedCandidateCount`
- `duplicateCandidateCount`
- `duplicateRate`
- `conversionRate`
- `rejectionRate`
- `lastSuccessfulImportAt?`
- `consecutiveFailureCount`
- `qualityLevel`: `good | watch | poor | unknown`

The current `qualityLevel` rules are deterministic: sources with no evidence are `unknown`; repeated failures, low success rate, or very high rejection rate are `poor`; recent failed / partial imports, weaker success rate, high duplicate rate, or elevated rejection rate are `watch`; the remaining observable healthy sources are `good`.

## ImportedCandidate

Represents imported external content after source-specific parsing and normalization, but before publication.

- `id`
- `sourceId?`
- `sourceType`
- `sourceName`
- `sourceUrl`
- `originalTitle`
- `originalSummary?`
- `originalContent?`
- `originalLanguage`
- `publishDate`
- `publisherName`
- `normalizedType`
- `tags`
- `importStatus`: `new | reviewed | converted | rejected`
- `duplicateGroupId?`
- `relatedCandidateIds`
- `reviewedAt?`
- `convertedTechnologyId?`
- `importedAt?`
- `importRunId?`
- `rawPayload`

This object belongs to the Internal Workspace only.

`sourceId`, `sourceName`, `sourceType`, `sourceUrl`, `importedAt`, and `importRunId` preserve traceability back to the configured `ExternalSource` and the batch import run when one exists.

## CandidateQualitySignals

Computed Internal Workspace signals for an imported candidate. These are review aids, not ranking or recommendation features.

Checks:

- `hasTitle`
- `hasSummary`
- `hasContent`
- `hasSourceUrl`
- `hasPublisher`
- `hasValidPublishDate`
- `hasTags`
- `isDuplicate`
- `isTooShort`
- `isConvertible`

Flag values:

- `missing_summary`
- `missing_content`
- `missing_publisher`
- `invalid_source_url`
- `invalid_publish_date`
- `missing_tags`
- `possible_duplicate`
- `too_short`
- `prerelease_version`
- `ready_for_review`
- `not_convertible`

`prerelease_version` (added 2026-07-27) fires when the title carries a
pre-release marker on a version-looking token (`v0.32.5-rc0`, `v0.26.0rc1`,
`v1.0.0-beta.2`). Release feeds publish these alongside — and usually days
before — the matching stable tag, and every editorial round so far has
rejected them by hand. The flag only makes the batch visible; the reject/keep
judgment stays with the editor.

These flags appear only in workspace candidate review surfaces.

## TechnologyPriorityRanking

Represents Ranking v0 output for a candidate-derived draft or published technology item.

- `priorityLevel`: `high_priority | watch | low_priority`
- `priorityScore`: 0-100 helper score
- `priorityReasons`
- `priorityWarnings`
- `rankingUpdatedAt`
- `rankingSource`: `rule_based | manual_override`

Ranking v0 is deterministic and explainable. It uses source quality, candidate quality, duplicate state, additional references, content completeness, recency, and publisher metadata. It does not use AI judgement or personalized recommendation.

`priorityScore` is mainly for internal review and validation. User-facing pages should emphasize `priorityLevel` and short product copy rather than score details.

Since 2026-07-27, `priorityLevel` for **published technology records** is
banded by the editor's `importanceLevel` (`critical` → high; `important` →
high within 30 days, else watch; `signal` → watch), with `priorityScore`
demoted to the within-band ordering key and still able to force
`low_priority` for records under 45. Imported candidates keep the original
score thresholds. See `docs/architecture.md` → "Ranking v0".

## DailyDigest

Represents a generated and editor-controlled daily brief built from published `TechnologyItem` records.

- `id`
- `date`
- `status`: `draft | published | archived`
- `title`
- `summary`
- `editorialSummary?`
- `highPriorityTechnologyIds`
- `watchTechnologyIds`
- `manuallyAddedTechnologyIds`
- `excludedTechnologyIds`
- `pinnedTechnologyIds`
- `orderedTechnologyIds`
- `skillIds`
- `knowledgeIds`
- `sourceNames`
- `generatedAt`
- `updatedAt`
- `lastRegeneratedAt?`
- `publishedAt?`
- `editorialNotes`

Daily Digest v0 is derived from Ranking v0:

- `high_priority` technology items become the immediate-attention section
- `watch` technology items become the worth-tracking section
- `low_priority` items are excluded by default
- manually added items can override the default exclusion behavior
- excluded items stay out during regeneration
- pinned items are displayed first
- ordered IDs preserve editor-controlled ordering without adding a drag-and-drop dependency
- related skill and knowledge IDs are aggregated from selected technology items
- source names are aggregated from selected technology items

Digest records are stored in local JSON as workspace-managed content. Draft and archived digests are workspace-only. Published digests are safe for user-facing display because they reference published technologies and public source names only.

Regeneration behavior:

- refresh generated high/watch sections from current Ranking v0 output
- preserve `editorialSummary`, `manuallyAddedTechnologyIds`, `excludedTechnologyIds`, `pinnedTechnologyIds`, `orderedTechnologyIds`, and `editorialNotes` when a digest has manual adjustments
- never publish automatically

Digest publish readiness blocking errors:

- missing title
- invalid or missing date
- no selected technology items
- unknown TechnologyItem reference
- unpublished TechnologyItem reference
- duplicate TechnologyItem reference
- selected item missing public digest fields such as title, summary, slug, source, source URL, or publish date

Digest publish readiness warnings:

- no high-priority items
- no related skills
- no related knowledge
- missing editorial summary
- no source names
- unusually low or high watch-item count

## DigestDeliveryFeed

Represents a derived public feed view, not a persisted workflow entity.

Feed routes:

- `/feed.xml`
- `/feed.json`

Each feed item is derived from a `DailyDigest` only when `status = published`.

Public feed fields:

- `date`
- `title`
- `summary`
- `digestUrl`
- `highPriorityItems`
- `watchItems`
- `skillNames`
- `knowledgeNames`
- `sourceNames`
- `publishedAt`
- `updatedAt`

Delivery rules:

- draft and archived digests are excluded
- feed items link to `/digest/[date]`
- feed items use public digest copy and safe published technology fields
- feed output never includes `rawPayload`, `importStatus`, `normalizedType`, `duplicateGroupId`, source health details, quality flags, manual digest adjustment IDs, `editorialNotes`, or `priorityScore`

Share text preview is also derived data. It is shown inside the Internal Workspace for manual copying after publication, but it does not send content to any external platform.

## DeliveryChannel

Represents a workspace-only destination for manually sending a published daily digest.

- `id`
- `name`
- `type`: `webhook | feishu_webhook`; `email | telegram | discord` are reserved only
- `enabled`
- `endpointUrl`
- `description?`
- `format`: `json | text`
- `lastDeliveredAt?`
- `lastDeliveryStatus?`: `pending | success | failed`
- `lastDeliveryMessage?`
- `createdAt`
- `updatedAt`

This is not a user subscription record. It belongs only to the Internal Workspace and is stored in `config/delivery.json`. Endpoint URLs may be visible in edit controls for workspace users, but list displays should use masked URLs. The local JSON workflow is not a production secret store; real production webhook tokens should move to secure secret storage.

Channel type behavior:

- `webhook`: generic HTTP POST adapter, supports `json` and `text`
- `feishu_webhook`: Feishu bot webhook adapter, supports Feishu text messages
- `email | telegram | discord`: reserved extension points, not implemented in v1

## DeliveryRun

Represents one delivery attempt for one digest and one channel.

- `id`
- `digestId`
- `digestDate`
- `channelId`
- `channelName`
- `channelType`
- `status`: `pending | success | failed`
- `startedAt`
- `finishedAt?`
- `requestPayloadPreview`
- `responseStatus?`
- `responseBodyPreview?`
- `errorMessage?`
- `retryOfDeliveryRunId?`

Delivery runs are append-only audit records for workspace review. They are never rendered on user-facing product pages or public feeds.

Delivery rules:

- only published digests can be sent
- draft and archived digests are blocked
- delivery does not change digest content
- failed sends record readable errors
- retry creates a new `DeliveryRun` linked to the original failed run
- webhook and Feishu payloads are derived from published digest and published `TechnologyItem` data only
- logs do not store the complete `endpointUrl`

## ScheduledDelivery

Represents a workspace-only local schedule for sending a published digest to configured delivery channels.

- `id`
- `name`
- `enabled`
- `digestTarget`: `latest_published_digest | digest_by_date`
- `digestDate?`
- `channelIds`
- `scheduleTime`: simple `HH:mm`
- `timezone`: defaults to `Asia/Shanghai`
- `lastRunAt?`
- `nextRunAt?`
- `lastRunStatus`: `never_run | success | failed | partial`
- `lastRunMessage?`
- `createdAt`
- `updatedAt`

The schedule decides when to send. It does not own the digest content and it does not own platform-specific delivery behavior. `DailyDigest` owns what is sent, `DeliveryChannel` owns where it is sent, and the delivery adapter owns the platform payload.

## ScheduledDeliveryRun

Represents one schedule execution across all selected channels.

- `id`
- `scheduleId`
- `scheduleName`
- `digestId?`
- `digestDate?`
- `startedAt`
- `finishedAt?`
- `status`: `never_run | success | failed | partial`
- `totalChannels`
- `successfulChannels`
- `failedChannels`
- `skippedChannels`
- `deliveryLogIds`
- `triggerType`: `scheduled | manual | retry`
- `message`

Each channel send inside a schedule still creates a normal `DeliveryRun`; `ScheduledDeliveryRun.deliveryLogIds` links the schedule-level audit record to those per-channel logs.

Scheduled delivery rules:

- disabled schedules do not run
- disabled channels are skipped
- only published digests can be sent
- one channel failure does not stop the remaining channels
- scheduled runs skip duplicate same-day sends for the same schedule / digest / channel
- manual runs are explicit operator-triggered force runs

## TaskRunnerRun

Represents one local command-line task runner pass.

- `id`
- `mode`: `run_once | watch`
- `startedAt`
- `finishedAt`
- `status`: `success | failed | partial`
- `dueScheduleCount`
- `skippedScheduleCount`
- `successCount`
- `failedCount`
- `partialCount`
- `deliveryLogsCreated`
- `messages`

`TaskRunnerRun` is an audit summary, not a delivery log. It groups the result of checking due schedules from the command line. The per-schedule detail remains in `ScheduledDeliveryRun`, and the per-channel send detail remains in `DeliveryRun`.

Task runner rules:

- `tasks:run-once` runs due schedules once and exits
- `tasks:watch` repeats the same due-schedule check in a local development loop
- disabled schedules and future schedules are skipped
- schedule and channel failures are recorded without crashing the whole runner
- messages are sanitized before storage so endpoint URLs and token-like values are not preserved in runner logs
- the runner reuses scheduled-delivery duplicate protection for same-day schedule / digest / channel sends
- each pass also checks `ScheduledImportConfig` and runs the due daily source
  import first; a failed import downgrades an otherwise successful pass to
  `partial`, and the import summary is appended to `messages`

## ScheduledImportConfig

Represents the workspace-only configuration for the task-runner scheduled
daily source import (v0). Stored as a single object in
`config/scheduled-import.json` (new in the news fast lane milestone), not a
list.

- `enabled` (default `true`)
- `scheduleTime`: simple `HH:mm` (default `08:00`)
- `timezone`: defaults to `Asia/Shanghai`
- `nextRunAt?`: missing means "due on the next runner pass" (bootstrap)
- `lastRunAt?`
- `lastRunStatus`: `never_run | success | failed | partial`
- `lastRunMessage?`
- `updatedAt`

Scheduled import rules:

- the task runner runs the import when `enabled` and `nextRunAt` is missing
  or in the past, then advances `nextRunAt` to the next scheduled time — this
  doubles as same-day duplicate protection
- unattended imports run with `useFallbackOnFailure: false`, so source
  failures update source health but never create fallback placeholder
  candidates
- the import itself is the existing `runBatchImportForEnabledSources`; its
  `ImportRun` record and per-source health updates are unchanged
- managed from `/workspace/delivery/schedules`
  (`PATCH /api/workspace/scheduled-import`); never rendered on user-facing
  pages

## ScheduledDigestConfig

Represents the workspace-only configuration for the task-runner scheduled
daily digest **draft** generation. A structural sibling of
`ScheduledImportConfig`, stored as a single object in
`config/scheduled-digest.json` (`src/lib/scheduled-digest.ts`).

- `enabled` (default `true`)
- `scheduleTime`: simple `HH:mm` (default `08:00`, deliberately the same as
  the import — in-pass code order guarantees the import runs first)
- `timezone`: defaults to `Asia/Shanghai`
- `nextRunAt?`: missing means "due on the next runner pass" (bootstrap)
- `lastRunAt?`
- `lastRunStatus`: `never_run | success | failed`
- `lastRunMessage?`
- `updatedAt`

Scheduled digest rules:

- the task runner generates today's digest draft when `enabled` and
  `nextRunAt` is missing or in the past, then advances `nextRunAt` — this
  doubles as same-day duplicate protection
- when the day already has a digest (any status), the run **skips** without
  touching it — unattended runs never modify a digest an editor may be
  editing
- only `status = draft` digests are ever created; publishing stays behind
  the editorial gate, and a failed generation downgrades the runner pass to
  `partial` while still advancing `nextRunAt`
- generation is the existing `generateDailyDigest`; managed from
  `/workspace/delivery/schedules` (`PATCH /api/workspace/scheduled-digest`);
  never rendered on user-facing pages

## WorkflowEvent

Represents a lightweight internal audit event for a workflow state transition or failure.

- `id`
- `entityType`
- `entityId`
- `action`
- `actorType`: `system | workspace_user | task_runner`
- `actorId?`
- `beforeSnapshot?`
- `afterSnapshot?`
- `metadata?`
- `createdAt`

Current event actions include:

- `candidate.status_updated`
- `candidate.converted_to_draft`
- `candidate.convert_failed`
- `duplicate_group.updated`
- `duplicate_group.resolved`
- `draft.updated`
- `draft.published`
- `draft.publish_failed`
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
- `prompt_version.created`
- `enrichment_suggestion.generated`
- `enrichment_suggestion.reviewed`
- `enrichment_suggestion.applied`
- `enrichment_suggestion.rejected`
- `enrichment_suggestion.marked_stale`

Workflow events are Internal Workspace records only. They may include sanitized before/after snapshots and metadata that help debug state changes. They must not appear in user-facing technology pages, digest pages, RSS/JSON feeds, or public navigation.

Endpoint-like and token-like fields are sanitized before storage. This is a guardrail, not a production secret-management replacement.

## PromptVersion

Represents an internal prompt contract used by an AI generation workflow.

- `id`
- `name`
- `purpose`: `editorial_enrichment`, `technology_comparison`,
  `technology_explanation`, or `technology_learning_path`
- `version`
- `status`: `active | draft | deprecated`
- `template`
- `outputSchema`
- `createdAt`
- `updatedAt`
- `notes?`

The active prompt version for a purpose is used when generating output for that
purpose (Editorial Enrichment suggestions, public technology comparisons, or
public per-level technology explanations). Each generated record stores
`promptVersionId` and the prompt `version` string so the prompt that produced
it can be traced. `getActivePromptVersion(purpose)` falls back to a
purpose-specific default (`defaultEditorialEnrichmentPromptVersion`,
`defaultTechnologyComparisonPromptVersion`, or
`defaultTechnologyExplanationPromptVersion`) when no active version exists in
the store for that purpose — the fallback is purpose-aware, not a single shared
default.

Prompt versions are internal workflow records. Prompt templates and schemas must not be rendered on user-facing pages or public feeds.

## TechnologyComparisonRecord (derived-cache entity)

Represents one AI-generated comparison between two published technologies,
generated by the public-facing "Compare two technologies" feature (P3 v0).
Like `DailyDigest` or `EditorialEnrichmentSuggestion`, this is a real persisted
entity written to disk (`config/technology-comparisons.json`) — it is the only
source of truth for "has this technology pair already been compared" — not a
purely derived view like `ContentGraphNode`/`ContentGraphEdge`.

- `id`
- `pairKey`: sorted `${technologyIdA}::${technologyIdB}`, used as the cache key
- `technologyIdA` / `technologyIdB`: always stored in sorted order, regardless
  of which technology the reader compared "from"
- `fields`: `TechnologyComparisonFields` — `similarities: string[]`,
  `differences: string[]`, `whenToPreferA: string`, `whenToPreferB: string`,
  `sharedConsiderations?: string[]`
- `generationMode`: `mock_llm | llm_assisted`
- `providerName?`, `modelName?`, `promptVersionId?`, `promptVersion?` — internal-only
- `outputValidationStatus`: `valid | warning | failed`
- `outputValidationWarnings: string[]`
- `generationError?` — internal-only
- `createdAt`, `updatedAt`

A pair is generated once and reused: `generateOrGetTechnologyComparison` checks
the store by `pairKey` before calling the LLM provider, so repeated requests for
the same unordered pair never trigger a second generation.

The public API response (`TechnologyComparisonPublicResult`) is a strictly
narrower shape mapped from this record by `toPublicComparisonResult` in
`src/lib/technology-comparison.ts` — the single place this internal-to-public
field strip happens:

- `technologyIdA`, `technologyIdB`, `fields`, `generatedAt` (mapped from `updatedAt`)
- `disclaimer`: a fixed, always-present string, never omitted

`generationMode`, `providerName`, `modelName`, `promptVersionId`, `promptVersion`,
`outputValidationWarnings`, and `generationError` are internal-only and never
appear in `TechnologyComparisonPublicResult` or any other public response.

## TechnologyExplanationRecord (derived-cache entity)

Represents one AI-generated explanation of a published technology tailored to
a reader-selected experience level, generated by the public-facing "Explain at
the reader's level" feature (P3 v1). Structurally a sibling of
`TechnologyComparisonRecord` with a different cache dimension, persisted to
`config/technology-explanations.json`.

- `id`
- `cacheKey`: `${technologyId}::${audienceLevel}`, used as the cache key
- `technologyId`
- `audienceLevel`: `beginner | intermediate | advanced`
- `fields`: `TechnologyExplanationFields` — `explanation: string`,
  `keyPoints: string[]`, `analogy?: string`, `nextSteps?: string[]`
- `generationMode`: `mock_llm | llm_assisted`
- `providerName?`, `modelName?`, `promptVersionId?`, `promptVersion?` — internal-only
- `outputValidationStatus`: `valid | warning | failed`
- `outputValidationWarnings: string[]`
- `generationError?` — internal-only
- `createdAt`, `updatedAt`

A technology × level combination is generated once and reused:
`generateOrGetTechnologyExplanation` checks the store by `cacheKey` before
calling the LLM provider.

The public API response (`TechnologyExplanationPublicResult`) is mapped by
`toPublicExplanationResult` in `src/lib/technology-explanation.ts` — the single
place this internal-to-public field strip happens:

- `technologyId`, `audienceLevel`, `fields`, `generatedAt` (mapped from `updatedAt`)
- `disclaimer`: a fixed, always-present string, never omitted

The same internal-only fields as `TechnologyComparisonRecord`
(`generationMode`, provider/model/prompt metadata, validation warnings, and
generation errors) never appear in any public response.

## TechnologyLearningPathRecord (derived-cache entity)

Represents one AI-generated, graph-grounded learning path for a published
technology, generated by the public-facing "Learning path" feature (P3 v2).
Structurally a sibling of `TechnologyComparisonRecord` /
`TechnologyExplanationRecord`, persisted to
`config/technology-learning-paths.json` and keyed by `technologyId` (one
cached path per technology).

- `id`
- `technologyId` — also the cache key
- `fields`: `TechnologyLearningPathFields` — `overview: string`,
  `steps: string[]` (ordered), `checkpoints?: string[]`
- `generationMode`: `mock_llm | llm_assisted`
- `providerName?`, `modelName?`, `promptVersionId?`, `promptVersion?` — internal-only
- `outputValidationStatus`: `valid | warning | failed`
- `outputValidationWarnings: string[]`
- `generationError?` — internal-only
- `createdAt`, `updatedAt`

Generation is graph-grounded: the prompt includes the technology's related
knowledge and related skill items (titles + summaries resolved from
`relatedKnowledgeIds` / `relatedSkillIds`), and the model is instructed to
build the steps on them by name.

The public API response (`TechnologyLearningPathPublicResult`) is mapped by
`toPublicLearningPathResult` in `src/lib/technology-learning-path.ts`:

- `technologyId`, `fields`, `generatedAt` (mapped from `updatedAt`)
- `disclaimer`: a fixed, always-present string, never omitted

The same internal-only fields as the other two AI-cache records never appear
in any public response.

## Deployment Configuration

Deployment configuration is not persisted as content. It is read from environment variables at runtime.

- `NEXT_PUBLIC_SITE_URL`: public base URL used by digest pages and feed links.
- `WORKSPACE_ACCESS_ENABLED`: enables the minimal workspace/API protection middleware.
- `WORKSPACE_ACCESS_TOKEN`: shared token accepted by Bearer, Basic auth password, or `x-workspace-access-token`.
- `LOCAL_DATA_DIR`: local JSON workflow directory; defaults to `./config`.
- `TASK_RUNNER_INTERVAL_SECONDS`: default interval for `npm run tasks:watch`.
- `DELIVERY_WEBHOOK_ENDPOINT` and `FEISHU_WEBHOOK_ENDPOINT`: optional operator references only; real channel endpoints are managed in the Internal Workspace.

The workspace token and delivery endpoint secrets are not user-facing data fields and must not be rendered into public pages or public feeds.

## ImportRun

Represents the latest batch import summary for all enabled sources.

- `id`
- `startedAt`
- `finishedAt`
- `status`: `success | failed | partial`
- `totalSources`
- `enabledSources`
- `skippedSources`
- `successfulSources`
- `failedSources`
- `partialSources`
- `totalCandidatesCreated`
- `totalCandidatesSkipped`
- `messages`
- `sourceResults`

The current local JSON workflow stores the latest run and a short recent run list in `external-sources.json`. This is not a scheduler or background job system.

## DuplicateGroup

Represents a possible duplicate set of imported candidates.

- `id`
- `candidateIds`
- `primaryCandidateId`
- `status`: `open | resolved | ignored`
- `reasons`
- `createdAt`
- `updatedAt`

Current reason codes:

- `same_source_url`
- `similar_title`
- `same_publisher_near_date`
- `same_repo_release_family`
- `same_canonical_url`

The group is an Internal Workspace object. It helps reviewers compare candidates, choose one primary candidate, and prevent duplicate draft generation.

`ImportedCandidate.duplicateGroupId` and `relatedCandidateIds` remain convenience fields for list/detail rendering. The persisted group status and selected primary live in `duplicate-groups.json`.

When a resolved duplicate group is converted, the primary candidate becomes the main draft source. Non-primary candidates are stored as additional source references on the draft.

## TechnologyItem

Represents formal technology content that can be shown to end users.

- `id`
- `slug`
- `status`: `draft | published | archived`
- `sourceLanguage`
- `translationStatus`
- `title`
- `summary`
- `content`
- `type`
- `publishDate`
- `sourceName`
- `sourceUrl`
- `publisherName`
- `publisherType`
- `importanceLevel`
- `tags`
- `relatedKnowledgeIds`
- `relatedSkillIds`
- `relatedTechnologyIds?`
- `sourceReferences?`
- `priority?`
- `whyItMatters?`
- `whoShouldCare?`
- `technicalContext?`
- `impactAreas?`
- `learningPath?`
- `relatedKnowledgeExplanations?`
- `relatedSkillExplanations?`
- `followUpQuestions?`
- `readingDifficulty?`: `beginner | intermediate | advanced`
- `intelligenceStatus?`: `draft | reviewed | needs_enrichment`

This is the shape consumed by the user-facing technology pages.

`sourceReferences` is safe user-facing reference metadata only. It does not contain candidate IDs, duplicate group IDs, duplicate reasons, raw payloads, or review status.

The Content Intelligence fields are user-facing enrichment fields. They explain why the technology matters, who should care, what background is needed, which skills help, and what to investigate next. They are not ranking scores and they are not internal quality flags.

## EditorialEnrichmentSuggestion

Represents a workspace-only generated suggestion for Content Intelligence fields. It is not a published content object and is not rendered on user-facing pages.

- `id`
- `technologyDraftId`
- `status`: `draft | applied | rejected | stale`
- `generatedFields`
- `sourceInputs`
- `generationMode`: `rule_based | llm_assisted | mock_llm`
- `providerName?`
- `modelName?`
- `promptVersionId?`
- `promptVersion?`
- `outputValidationStatus?`: `not_applicable | valid | warning | failed`
- `outputValidationWarnings?`
- `confidence?`
- `limitations?`
- `tokenUsage?`
- `generationError?`
- `createdAt`
- `updatedAt`
- `reviewedAt?`
- `appliedAt?`
- `rejectedAt?`
- `reviewerNotes?`
- `reviewStatus?`: `unreviewed | accepted | partially_accepted | rejected`
- `qualityScore?`: editor score from `1..5`
- `qualityLabels?`: `accurate | clear | too_generic | too_verbose | missing_context | hallucination_risk | needs_human_edit | good_enough`
- `rejectionReason?`
- `appliedFields?`

`generatedFields` can include `whyItMatters`, `whoShouldCare`, `technicalContext`, `impactAreas`, `learningPath`, `relatedKnowledgeExplanations`, `relatedSkillExplanations`, `followUpQuestions`, and `readingDifficulty`.

`sourceInputs` stores the draft title, summary, content preview, source, publisher, tags, priority reasons, related knowledge, related skills, and an input signature so regenerated suggestions can mark older draft suggestions `stale`.

Generation modes:

- `rule_based`: deterministic local templates with no provider call
- `mock_llm`: local mock provider with no API key
- `llm_assisted`: OpenAI-compatible provider when configured, with safe fallback to `mock_llm` when no API key exists

LLM-assisted suggestions are validated before they can be applied. Invalid JSON, internal-only fields, unsupported shapes, or empty usable output are stored with `outputValidationStatus = failed` and `generationError`; failed suggestions cannot update `TechnologyWorkspaceRecord`.

Suggestions only affect `TechnologyWorkspaceRecord` after an editor clicks Apply. Apply / reject / stale / failed transitions are recorded in `WorkflowEvent`.

Prompt Quality v1 adds human review metadata. Apply all marks the suggestion `accepted`; applying selected generated fields marks it `partially_accepted`; rejection records `rejectionReason` and leaves the draft unchanged. These review fields are not Ranking v0 and are not user-facing content.

## TechnologyWorkspaceRecord

Represents the internal workspace version of a technology record.

- inherits `TechnologyItem`
- `sourceCandidateId?`
- `sourceReferences?`
- `createdAt`
- `updatedAt`
- `editorialNotes`

This object is used in the Internal Workspace so draft records, published records, and archived records can all be managed in one place.

The workspace detail page can edit the user-facing fields on this record before publication. The editable surface is intentionally limited to content, source metadata, tags, related knowledge, related skills, related technologies, Content Intelligence fields, and editorial notes.

`relatedTechnologyIds` became editable on 2026-07-27; before that it existed
only on the bundled seed data, so no two workspace-published signals could
ever be linked to each other. The workflow drops a self-reference (which would
render as a self-edge on `/network`), and the picker offers published
technologies only — a link to an unpublished draft would render as a dead
node.

The workspace detail page also edits Content Intelligence fields. Missing explanation fields produce publish warnings because they reduce user-facing understanding quality, but they are not blocking errors in v1.

The workspace detail page also shows Editorial Enrichment suggestions. Suggestions are stored outside the record until applied; rejected suggestions and reviewer notes remain internal audit data.

Publishing a workspace record runs Publish Quality Gate v0. The checks do not add new persisted fields; they compute blocking errors and warnings from the current record plus the existing technology slugs.

When generated from a resolved duplicate group, `sourceReferences` may include additional duplicate sources with internal traceability fields such as `candidateId` and `sourceType`. The user-facing mapping strips those internal fields before rendering published content.

## SkillItem

Represents a skill that helps the user evaluate or apply a technology.

- `id`
- `title`
- `slug`
- `summary`
- `content`
- `skillType`
- `heatLevel`
- `learningCost`
- `tags`
- `relatedTechnologyIds`
- `relatedKnowledgeIds`

## KnowledgeItem

Represents a classic concept that helps explain newer technology signals.

- `id`
- `title`
- `slug`
- `summary`
- `content`
- `category`
- `difficulty`
- `tags`
- `relatedTechnologyIds`
- `relatedSkillIds`

## SkillWorkspaceRecord / KnowledgeWorkspaceRecord

Workspace-only editable versions of `SkillItem` / `KnowledgeItem` (Skill/
Knowledge workspace editing v0, 2026-07-16). Each extends the public item
shape with:

- `status`: `draft | published` (`ContentWorkspaceStatus`)
- `createdAt` / `updatedAt`

Stored in `config/skill-workspace.json` / `config/knowledge-workspace.json`
(`skill-workflow.ts` / `knowledge-workflow.ts`). The stores are a
**copy-on-write overlay** over the `src/data` seed arrays:

- editing a seed entry copies it into the store (initial status `published`,
  since the seed version is already live); the seed data files are never
  modified
- new entries are created directly in the store with status `draft`
- the public read (`getAllSkills` / `getAllKnowledge` in `content.ts`)
  merges seeds with the store: a published record overrides its seed by id,
  a draft record hides its seed, and store-new records appear only once
  published; the merged items carry no workspace-only fields
- entry origin (`workspace | seed | seed_override`,
  `ContentWorkspaceOrigin`) is derived at read time, not persisted

Publishing runs a minimal gate: missing title/slug/summary and a duplicate
slug (within the merged pool of the same kind) block; short content,
missing or non-canonical tags, and missing related content warn. Status and
edit transitions record `skill.*` / `knowledge.*` workflow events. v0
edited related-content id lists only; LinkRelation v1 (2026-07-19) added
typed relation editing on top — see the `LinkRelation` section below.

## TopicTag

Cross-cutting label used for browsing and grouping.

- `id`
- `name`
- `description`

## LinkRelation

Explicit typed relationship between content objects.

- `id`
- `fromId`
- `fromType`
- `toId`
- `toType`
- `relationType`
- `note?` (optional since LinkRelation v1, to support type-only overrides)

`findRelationBetween(aId, aType, bId, bType)` in `src/lib/content.ts` looks up
the relation for an unordered pair regardless of which side `LinkRelation`
records as `from`/`to`, falling back to `related-to` when no explicit entry
exists for that pair.

Since LinkRelation v1 (2026-07-19), relations are editable from the three
workspace editors (skill, knowledge, technology draft). Edits live in
`config/link-relation-workspace.json`
(`src/lib/link-relation-workflow.ts`) as a **copy-on-write overlay keyed
by unordered pair** over the read-only seed relations in
`src/data/relations.ts`:

- an override wins over the seed for the same pair, regardless of
  direction; all public reads (`findRelationBetween`,
  `buildRelationItems`, `getContentGraph`) go through the merged
  `getAllLinkRelations()` view
- setting a pair back to its seed value removes the override (clean
  revert); the generic default (`related-to`, no note) is never persisted
  for a pair with no seed entry
- pairs not mentioned in a save are left untouched, so an override
  written from the other side of a shared pair survives
- edits record `link_relation.updated` workflow events; the API surface
  is `PUT /api/workspace/relations` (batch per source entity) behind the
  workspace boundary

## PublicNewsItem / PublicNewsDay (derived)

Represents the public news fast lane view for the 全部快讯 view on
`/technologies?view=news` and the home news board. Like `DigestDeliveryFeed`,
this is a derived view computed on read by
`getPublicNewsItems()` / `getPublicNewsDays()` in `src/lib/news.ts`, not a
persisted entity. It is the only mapping through which an `ImportedCandidate`
may reach a public surface.

`PublicNewsItem`:

- `key`: derived from date + source URL (never the candidate id)
- `title`
- `summary?`: trimmed and truncated
- `sourceName`
- `sourceUrl`
- `publishDate`
- `tags`: display names (canonical `TopicTag` names when the tag is a known id)
- `publishedTechnology?`: `{ slug, title }` when the candidate was converted
  and the technology is published

`PublicNewsDay`: `{ date, items }`, grouped and sorted newest-first.

Mapping rules (enforced in `src/lib/news.ts`): last 7 days only (max 200
items), rejected candidates excluded, `fallback`-tagged placeholder
candidates excluded, non-primary members of open/resolved duplicate groups
excluded. `rawPayload`, `originalContent`, `importStatus`, `normalizedType`,
candidate IDs, and duplicate internals never enter the public shape. All
fast-lane surfaces render the fixed 自动聚合 disclaimer.

## ContentGraphNode / ContentGraphEdge (derived)

Represents the whole technology/skill/knowledge graph for the `/network`
overview page. Like `DigestDeliveryFeed`, this is a derived view computed by
`getContentGraph()` in `src/lib/content.ts`, not a persisted entity.

`ContentGraphNode`:

- `id`
- `title`
- `href`
- `kind`

`ContentGraphEdge`:

- `id`
- `sourceId`
- `targetId`
- `relationType`
- `note?`

Nodes are every published technology, skill, and knowledge item. Edges are
every `relatedXIds` reference across all three entity types, deduplicated as
an unordered pair (an edge exists if either side declares the reference), with
`relationType`/`note` resolved via `findRelationBetween`.

## TopicHubData (derived)

Represents the `/topics/[tagId]` topic hub page — like `ContentGraphNode`,
a derived view computed by `getTopicHub(tagId)` in `src/lib/topic-hub.ts`,
not a persisted entity.

- `tag`: the `TopicTag`
- `technologies`: published `TechnologyItem`s tagged with `tagId`
  (newest-first), mapped to a safe `{ slug, title, summary, publishDate,
sourceName }` shape via the same bilingual title/summary helpers
  `/timeline` uses
- `skills`: `SkillItem`s tagged with `tagId`
- `knowledge`: `KnowledgeItem`s tagged with `tagId`
- `relatedNodes`: the topic's direct neighbors in `getContentGraph()` —
  every node connected by an edge to any technology/skill/knowledge above,
  excluding nodes already in one of those three lists, each carrying its
  edge's `relationType`/`note`

Returns `undefined` (page renders `notFound()`) when the tag id doesn't
exist or none of the three pools has a match — mirroring `/timeline`'s
"only topics with at least one published signal" rule, extended to all
three content kinds.

## Internal-only vs user-facing fields

Internal-only fields:

- `importStatus`
- `normalizedType`
- `duplicateGroupId`
- `relatedCandidateIds`
- `DuplicateGroup.reasons`
- `DuplicateGroup.status`
- `DuplicateGroup.primaryCandidateId`
- `reviewedAt`
- `convertedTechnologyId`
- `rawPayload`
- `sourceCandidateId`
- `editorialNotes`
- `SourceQualityMetrics`
- `CandidateQualitySignals`
- candidate quality flags
- source quality level and rates
- raw source quality metrics
- duplicate review reason codes
- `EditorialEnrichmentSuggestion`
- editorial enrichment `generationMode`
- editorial enrichment `sourceInputs`
- editorial enrichment provider/model/prompt metadata
- editorial enrichment token usage
- editorial enrichment validation warnings and generation errors
- `TechnologyComparisonRecord.generationMode`
- `TechnologyComparisonRecord.providerName` / `modelName` / `promptVersionId` / `promptVersion`
- `TechnologyComparisonRecord.outputValidationWarnings` / `generationError`
- `TechnologyComparisonRecord.pairKey` / `id` (internal cache bookkeeping, not returned to the client)
- `TechnologyExplanationRecord.generationMode`
- `TechnologyExplanationRecord.providerName` / `modelName` / `promptVersionId` / `promptVersion`
- `TechnologyExplanationRecord.outputValidationWarnings` / `generationError`
- `TechnologyExplanationRecord.cacheKey` / `id` (internal cache bookkeeping, not returned to the client)
- `TechnologyLearningPathRecord.generationMode`
- `TechnologyLearningPathRecord.providerName` / `modelName` / `promptVersionId` / `promptVersion`
- `TechnologyLearningPathRecord.outputValidationWarnings` / `generationError`
- `TechnologyLearningPathRecord.id` (internal cache bookkeeping, not returned to the client)

User-facing priority fields:

- the productized priority level and its short explanation copy, derived on
  demand via `evaluateTechnologyPriority` at render time — public
  `TechnologyItem`s carry no persisted `priority` object, so ranking
  internals never enter client-component RSC payloads (the full
  `TechnologyPriorityRanking` stays on `TechnologyWorkspaceRecord`)

Fields not shown in the user-facing UI:

- `priorityScore`
- raw `priorityReasons`
- raw `priorityWarnings`
- source quality details
- candidate quality flags
- `DailyDigest.editorialNotes`
- `DailyDigest.manuallyAddedTechnologyIds`
- `DailyDigest.excludedTechnologyIds`
- `DailyDigest.pinnedTechnologyIds`
- `DailyDigest.orderedTechnologyIds`
- draft or archived digest status
- `DeliveryChannel.endpointUrl`
- `DeliveryRun.requestPayloadPreview`
- `DeliveryRun.responseBodyPreview`
- `DeliveryRun.retryOfDeliveryRunId`
- `ScheduledDelivery.channelIds`
- `ScheduledDelivery.scheduleTime`
- `ScheduledDelivery.lastRunStatus`
- `ScheduledDelivery.lastRunMessage`
- `ScheduledDeliveryRun.deliveryLogIds`
- `TaskRunnerRun.messages`
- delivery channel configuration, schedules, delivery logs, and task-runner audit summaries
- workflow event before/after snapshots, action history, and audit metadata
- workspace access token and deployment-only environment secrets

User-facing fields:

- `title`
- `summary`
- `content`
- `publishDate`
- `sourceName`
- `sourceUrl`
- `publisherName`
- `publisherType`
- `tags`
- `relatedKnowledgeIds`
- `relatedSkillIds`
- `whyItMatters`
- `whoShouldCare`
- `technicalContext`
- `impactAreas`
- `learningPath`
- `relatedKnowledgeExplanations`
- `relatedSkillExplanations`
- `followUpQuestions`
- `readingDifficulty`
- `intelligenceStatus`
- `sourceReferences` without internal traceability fields
- `sourceLanguage`
- `translationStatus`
- published digest title, summary, selected technology IDs, related skill IDs, related knowledge IDs, and source names
- published digest RSS / JSON feed fields derived from public digest data

The content helper layer maps published workspace records into a safe `TechnologyItem` shape before user-facing pages render them.

The same mapping is used by the workspace preview route so editors can inspect the user-facing output without publishing or exposing internal-only fields.

## Data lifecycle

The intended lifecycle is:

1. source configuration
2. external source
3. imported raw payload
4. `ImportedCandidate`
5. review / deduplicate
6. convert to technology draft
7. edit internal workspace record
8. run publish readiness checks and preview
9. publish
10. generate Daily Digest draft from published technology items
11. preview and publish digest
12. optionally send published digest to workspace-configured webhook or Feishu webhook channels
13. optionally run local scheduled delivery for published digests
14. user-facing display

The implementation now supports this lifecycle through local JSON workflow state.

Configured sources now sit before the external source step and can be managed at `/workspace/sources`.

## Duplicate detection v1

Current rules:

- same normalized source URL
- same canonical link from raw RSS / Atom / official blog payloads
- highly similar normalized title token overlap
- same publisher and similar title within a near publish-date window
- same GitHub repository release family for GitHub release sources

These rules are explainable and are shown back to reviewers in the workspace UI.

## Publish Quality Gate v0

Readiness checks are computed from `TechnologyWorkspaceRecord`.

Blocking errors:

- missing localized title
- missing localized summary
- missing slug
- duplicate slug
- missing source name
- invalid source URL
- invalid publish date
- missing localized content
- invalid enum-like fields needed by user-facing pages

Warnings:

- English-source record without Chinese title and summary
- fewer than two tags
- no related knowledge
- no related skills
- missing publisher name
- short summary
- short content
- empty editorial notes
- missing `whyItMatters`
- missing `whoShouldCare`
- missing related knowledge explanations
- missing related skill explanations
- missing learning path
- missing follow-up questions
- no editorial enrichment suggestion generated
- latest editorial enrichment suggestion still unreviewed

## Bilingual content scope

Only `TechnologyItem` currently uses localized content fields.

- `title: { original, zh, en? }`
- `summary: { original, zh, en? }`
- `content: { original, zh, en? }`

`SkillItem` and `KnowledgeItem` remain single-language for now.

## Local runtime stores

Local workflow state defaults to `config/` and can be moved with `LOCAL_DATA_DIR`:

- `imported-candidates.live.json`
- `candidate-review-state.json`
- `external-sources.json`
- `technology-workspace.json`
- `skill-workspace.json`
- `knowledge-workspace.json`
- `link-relation-workspace.json`
- `duplicate-groups.json`
- `daily-digests.json`
- `delivery.json`
- `scheduled-delivery.json`
- `scheduled-import.json`
- `scheduled-digest.json`
- `task-runner.json`
- `workflow-events.json`
- `editorial-enrichment-suggestions.json`
- `technology-comparisons.json`
- `technology-explanations.json`
- `technology-learning-paths.json`

This local JSON boundary is for local development and controlled single-operator environments. It is not a multi-user database, does not provide transaction isolation, and is not an appropriate production secret store.

The file-level read/write mechanics are centralized in `src/lib/repositories/local-json-store.ts`. Workflow modules own domain transitions:

- `source-workflow.ts`: sources and import runs
- `skill-workflow.ts` / `knowledge-workflow.ts`: skill and knowledge
  workspace records, seed copy-on-write overlay, publish gate, and the
  merged public read
- `link-relation-workflow.ts`: link relation overrides (copy-on-write over
  the seed relations, keyed by unordered pair) and the merged
  `getAllLinkRelations` read
- `candidate-workflow.ts`: imported candidates, review state, duplicate groups, and candidate → draft conversion
- `technology-draft-workflow.ts`: technology workspace record CRUD, publish/archive status transitions, and publish readiness lookup
- `digest-workflow.ts`: digest generation, editing, readiness, and status
- `delivery-workflow.ts`: delivery channels and delivery runs
- `scheduled-delivery-workflow.ts`: schedules and scheduled delivery runs
- `task-runner.ts`: local runner audit summaries
- `workflow-events.ts`: internal workflow events and sanitized audit snapshots
- `editorial-enrichment-store.ts` / `editorial-enrichment.ts`: suggestion storage, deterministic generation, apply, reject, and stale transitions

Pages and API routes should call these workflow modules and should not duplicate JSON parsing or file writes.

Future database tables / collections are documented in [`docs/persistence-plan.md`](persistence-plan.md). The main migration candidates are `sources`, `import_runs`, `imported_candidates`, `duplicate_groups`, `technology_drafts`, `technologies`, `knowledge_items`, `skill_items`, `daily_digests`, `delivery_channels`, `delivery_logs`, `scheduled_deliveries`, `task_runs`, `workflow_events`, and `editorial_enrichment_suggestions`.

Future transaction-sensitive flows include candidate conversion, duplicate resolution, draft publication, digest generation/regeneration, digest publication, delivery logging, scheduled delivery runs, and source import with source health updates.

## SQLite Persistence v0

Database Migration v0 adds SQLite as an optional persistence driver.

Environment:

- `PERSISTENCE_DRIVER=json`: read/write the local JSON stores listed above.
- `PERSISTENCE_DRIVER=sqlite`: read/write equivalent domain records from SQLite.
- `SQLITE_DATABASE_PATH`: optional override for the SQLite file path. Defaults to `config/ai-tech-radar.sqlite`.

Schema v0 tables:

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
- `skill_workspace_records`
- `knowledge_workspace_records`
- `link_relation_overrides`
- `runtime_configs`
- `technology_comparisons`
- `technology_explanations`
- `technology_learning_paths`

The last seven were added 2026-07-28. Until then the six newer JSON stores
(skill/knowledge workspace, link relation overrides, the two schedule configs,
and the three AI result caches) had no SQLite adapter at all, so in
`PERSISTENCE_DRIVER=sqlite` mode reads silently returned an empty overlay and
writes threw. `runtime_configs` is the one table that is not per-domain: the
two schedule configs are single objects rather than record lists, so they are
stored as one row each keyed by JSON filename.

Each table keeps a full JSON `payload` plus key query columns such as `id`, `status`, `slug`, `sourceId`, `sourceUrl`, `publishDate`, `enabled`, `createdAt`, and `updatedAt`.

Static seed technologies, knowledge items, and skill items are seeded into SQLite for SQLite-mode reads. JSON mode continues to use the TypeScript data files and local JSON stores.

The SQLite driver is intentionally a **document store** (decided 2026-07-05,
see `docs/decisions.md` → "SQLite Storage Model"): reads and writes move whole
domain stores, matching the JSON-file contract, and the key columns/indexes
are denormalized copies kept for future Postgres table-shape rehearsal and
external SQL inspection, not for business queries. It prioritizes preserving
existing workflow behavior and making the future database boundary
replaceable.
