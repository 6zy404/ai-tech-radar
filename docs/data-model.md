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
- `importHistory?`: `SourceImportHistoryEntry[]`, newest first, at most 30
  (2026-10-13)

Used by the source management UI and live importer layer. This is internal workflow structure, not user-facing content.

The health fields describe the latest observable import state for that source. `partial` means the live import failed but a local fallback candidate was used, so the workflow remains inspectable without pretending the source is healthy.

`SourceImportHistoryEntry` (`src/lib/source-health-history.ts`) is one
import attempt — batch, single-source or scheduled — and holds only:

- `at`
- `status`: `success | failed | partial`
- `candidatesCreated`, `candidatesSkipped`
- `errorSummary?`: not for a success; the message with every URL replaced by
  「[链接]」, secrets masked, cut to 160 characters

A source stored before the field existed is backfilled once on read from the
batch `ImportRun` records still in the store (the newest 20) that finished
after the source was created, and the next write persists it. Single-source
imports before 2026-10-13 were never recorded anywhere and cannot be
backfilled. The list page reads a 14-day success rate from it
(`getRecentImportSuccess`; `partial` counts as not successful).

**Deleting a source** (2026-10-13, `deleteExternalSource`) needs it to be
disabled first and removes the configuration and its `importHistory` only.
Its imported candidates keep their `sourceId` / `sourceName`, published
signals keep their `sourceName`, and `ImportRun` records keep their
per-source lines (an audit of that run; the backfill ignores runs older than
a source, so a source re-created under the same id does not inherit them). A
`source.deleted` workflow event records the configuration without its history.

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

`importedAt` is when the candidate was **first** imported: since 2026-10-14 a later import that fetches the same item again keeps it, so the operations dashboard's "oldest undecided over 7 days" alert can fire (until then every import reset it to the day of the import). `publishDate` is the Asia/Shanghai day of the feed's timestamp (until 2026-10-14 the UTC day, which filed items published 00:00–08:00 Beijing time under the day before); a date written without a time of day is kept as written.

`imported-candidates.live.json` is a **rolling window**, not an archive: a
successful import replaces that source's entries with what the feed currently
returns, so older items age out (40 candidates in the snapshot against 104
review entries on 2026-07-29). Every disposition survives independently in
`candidate-review-state.json`, which is why the window can be lossy — and why
duplicate detection, which only sees the window, needed the separate
`already_published` check.

A **failed** import is the one case where replacing is wrong. It falls back to
a single synthetic `fallback`-tagged placeholder, and until 2026-07-29 that
placeholder replaced the source's real candidates (it cost a recovered
`Ollama v0.32.5` candidate for real). `mergeImportedCandidatesForSource` now
takes `preserveExistingCandidates`, passed only from that branch, so the
placeholder is appended instead. Placeholders all carry the source's own feed
URL rather than an item URL, so repeated failures cannot stack them — the merge
skips an incoming candidate whose id or source URL already belongs to the
source. The merge rules themselves live in the pure
`buildMergedCandidateSnapshot`, which takes a snapshot and a `syncedAt` and
returns the next snapshot with no file I/O.

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

- `missing_summary` (an InfoQ 中文 description holding only its
  「点击查看原文>」 link, or a GitHub release body that is only 「No content.」,
  imports as an empty summary and reports this; GitHub Blog's trailing
  「The post … appeared first on The GitHub Blog.」 is stripped from an
  otherwise real summary — `trailingFeedBoilerplatePhrases`,
  `trailingFeedBoilerplateSentences` and `emptyFeedBodyPlaceholders` in
  `src/lib/text-sanitize.ts`)
- `missing_content`
- `missing_publisher`
- `invalid_source_url`
- `invalid_publish_date`
- `missing_tags`
- `possible_duplicate`
- `too_short`
- `prerelease_version`
- `already_published`
- `similar_to_published`
- `defacement_title`
- `ready_for_review`
- `not_convertible`

`prerelease_version` (added 2026-07-27) fires when the title carries a
pre-release marker on a version-looking token (`v0.32.5-rc0`, `v0.26.0rc1`,
`v1.0.0-beta.2`). Release feeds publish these alongside — and usually days
before — the matching stable tag, and every editorial round so far has
rejected them by hand. Since 2026-09-19 it also reads the tag in a GitHub
release URL, because Ollama's feed titles a release `v0.34.3` while the tag is
`v0.34.3-rc0` — a trap hit by hand twice before.

**Three flags now reject automatically**: `prerelease_version` and
`already_published` (2026-09-19), and `defacement_title` (2026-10-09), are acted on by the task runner right after the scheduled
import (`runCandidateAutoTriage` in `src/lib/candidate-auto-triage.ts`). Only
`new` candidates are touched, so an editor who reopens an auto-rejected item
is never overridden; each rejection is a `candidate.status_updated` event with
`actorType: "task_runner"` and `metadata.reason`. Every other flag still only
makes the batch visible — notably `missing_summary` / `missing_content`,
because feeds that ship no description have produced published signals.

`similar_to_published` (2026-10-13) is the embedding model's version of
`already_published`, and deliberately **not** one of the three: it fires when
a candidate's title + summary scores ≥ 0.92 cosine against a published
signal's original or Chinese text within 3 days, and the deterministic check
is silent. Measured on labelled history, about half of those are the same
announcement and the rest the same event or only the same topic
(`eval/dedup/README.md`), so it is a hint for the editor. It reads
`ImportedCandidate.semanticPublishedMatch` (`{ technologyId,
technologyTitle, score }`), attached on read from
`candidate-semantic-matches.json`; workspace-only, never in the news map.
Like `already_published` it is excluded from ranking's multiple-problems
count.

`defacement_title` (2026-10-09) fires when the title opens with a defacer's
signature — hacked / defaced / pwned / owned (leetspeak and Indonesian
「di hack」 included) followed directly by 「by」 / 「oleh」 — and is at most
eight words (`isDefacementTitle` in `src/lib/defacement-title.ts`). It was
built for the 2026-10-08 量子位 item 「hacked by trenggalek6etar」; across all
846 titles the snapshot has ever held it matches only that item.

`already_published` (added 2026-07-28) fires when the same announcement is
already on the site. It exists because duplicate detection compares only
against the **rolling candidate snapshot**, so an item re-published under a
changed URL slug re-enters the pool looking brand new once its earlier twin
has aged out (see `docs/editorial-round-playbook.md` → "Duplicate detection
blind spot"). The published pool outlives that window, so the check runs
against it: a candidate matches on a normalized source URL, or on a title
token similarity of **0.8 or above** against any of the published record's
localized titles. Two deliberate boundaries: the signal a candidate was itself
converted into is skipped (that match is traceability, not duplication), and
the flag is excluded from `ranking.ts`'s multiple-problems penalty, because it
describes the site's existing coverage rather than a defect in the record.
The threshold was measured, not guessed — over the real 40-candidate pool the
genuine re-publications scored 0.8 and 1.0 while the next-highest unrelated
candidate scored 0.3. A title-only match additionally needs **at least three
comparison tokens on both sides** (2026-09-19): an InfoQ piece on the history
of RSI scored 1.00 against the unrelated BigBang-v1 signal because both Chinese
headlines reduced to the single token `rsi`, and a one-token ratio can only be
0 or 1. Known limitation: comparison tokens are latin-only, so
two different all-Chinese titles can never match on token similarity.

**That sentence used to end "so this costs nothing today", and it was wrong in
both halves** (corrected 2026-08-18). Since 2026-08-10 the pool carries two
daily Chinese-language feeds, so it is not a hypothetical; and the failure runs
the _opposite_ way from what the note claimed. `normalizeTitleForComparison`
strips every non-latin character, so a Chinese headline collapses to whatever
latin fragments it happens to contain — on an AI feed, almost always the bare
string `ai`. The token rule then drops it (tokens must be ≥ 3 characters), but
the `similar_title` rule's _normalized-title_ branch only required a non-empty
result, and `ai` is non-empty. So two unrelated Chinese titles did not "never
match" — they **always** matched whenever both contained "AI". Three unrelated
candidates were grouped that way on 2026-08-18, which silently blocked the
non-primary ones from converting at all. The guard now uses the tokenizer's own
threshold (`hasComparableTitleTokens`); see `candidate-duplicate-rules.ts` and
the tests in `candidate-dedup.test.ts`, which also pin the genuinely remaining
limitation: two byte-identical all-Chinese titles are still not caught by the
title rules, because they normalize to the empty string.

The check needs published signals passed in
(`evaluateCandidateQuality(candidate, { publishedSignals })`, built with
`buildPublishedSignalFingerprints`). Callers that omit them — `ranking.ts`,
`operations-metrics.ts` — simply never see the flag.

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
- `type`: `webhook | feishu_webhook | telegram | discord`; `email` is reserved only
- `enabled`
- `endpointUrl`
- `description?`
- `format`: `json | text` (always `text` for Feishu, Telegram and Discord)
- `chatId?`: Telegram only — the chat, group or channel the bot posts to
- `botTokenMasked?`: Telegram only — `<bot id>:***`, the only form of the
  token any caller outside the delivery workflow sees
- `lastDeliveredAt?`
- `lastDeliveryStatus?`: `pending | success | failed`
- `lastDeliveryMessage?`
- `createdAt`
- `updatedAt`

This is not a user subscription record. It belongs only to the Internal Workspace and is stored in `config/delivery.json`. Endpoint URLs may be visible in edit controls for workspace users, but list displays should use masked URLs. The local JSON workflow is not a production secret store; real production webhook tokens should move to secure secret storage.

The stored record is `StoredDeliveryChannel` = `DeliveryChannel` plus
`DeliveryChannelSecrets` (`botToken?`, Telegram only, 2026-10-13). The token is
read only by `delivery-workflow.ts` and the Telegram adapter:
`getDeliveryChannels` / `getDeliveryChannelById` and the API answers return
`toClientDeliveryChannel`, which drops it and sets `botTokenMasked`, because
the delivery page hands channels to a client component and anything in them
reaches the browser. Saving a Telegram channel with the token field blank keeps
the stored token. The Telegram `endpointUrl` is the Bot API base (stored as
`https://api.telegram.org` when left blank; a local fake server or a
`mock://` address for testing); the request URL
`<base>/bot<token>/sendMessage` is built inside the adapter and never stored.

Channel type behavior:

- `webhook`: generic HTTP POST adapter, supports `json` and `text`
- `feishu_webhook`: Feishu bot webhook adapter, supports Feishu text messages
- `telegram` (2026-10-13): Bot API `sendMessage` with `parse_mode: "HTML"`
  (`<b>` and `<a href>` only, all text escaped), at most 4096 characters
- `discord` (2026-10-13): webhook URL of the form
  `/api/webhooks/<id>/<token>`; one embed (title 256, description 4096, two
  fields of at most 1024, 6000 in all) and `allowed_mentions: { parse: [] }`
- `email`: reserved extension point, not implemented

Feishu, Telegram and Discord send the same content
(`buildDigestChatMessage` in `src/lib/delivery/adapters/digest-message.ts`):
the published digest's title, date, summary, the first three 立即关注 and
值得跟踪 items, and the public digest link. Over a limit, whole blocks are
dropped and replaced by 「…」 (`fitBlocks`); the digest link is never cut.

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
- webhook, Feishu, Telegram and Discord payloads are derived from published digest and published `TechnologyItem` data only
- logs do not store the complete `endpointUrl` or the bot token; error
  messages and response previews pass through `maskSecretsInText`
  (`src/lib/secret-masking.ts`) before they are stored

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

Since 2026-09-28 the two share one implementation of everything except the
run itself — shape, defaults, normalization, `HH:mm` validation, the due
check and the "record a run, advance `nextRunAt`" step — in
`src/lib/daily-schedule-config.ts` (`DailyScheduleConfig<TRunStatus>`). The
only field-level difference is the run-status set: the import can end
`partial`, the digest draft cannot.

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

- `NEXT_PUBLIC_SITE_URL`: public base URL used by digest pages and feed links. Since 2026-10-21 it has one definition (`src/lib/site-url.ts`) and the launcher also reads it from `.env.local` for the task runner and the push sender, which refuse to send to a real channel while it is unset or loopback.
- `WORKSPACE_ACCESS_ENABLED`: enables the minimal workspace/API protection middleware.
- `WORKSPACE_ACCESS_TOKEN`: shared token accepted by Bearer, Basic auth password, or `x-workspace-access-token`.
- `LOCAL_DATA_DIR`: local JSON workflow directory; defaults to `./config`.
- `TASK_RUNNER_INTERVAL_SECONDS`: default interval for `npm run tasks:watch`.
- `BACKUP_DIR` / `BACKUP_KEEP` / `BACKUP_FORCE` (2026-10-21): the snapshot directory, how many of the newest days with a verified snapshot to keep (days, not snapshots), and a manual extra copy.
- `LOG_TIMESTAMPS=1` (2026-10-21): the launcher prefixes every line the child process writes with an ISO-8601 UTC time; off unless a scheduled task's command line sets it.
- `DELIVERY_WEBHOOK_ENDPOINT` and `FEISHU_WEBHOOK_ENDPOINT`: optional operator references only; real channel endpoints are managed in the Internal Workspace.
- `PUBLIC_AI_RATE_LIMIT_PER_MINUTE` / `PUBLIC_AI_RATE_LIMIT_PER_HOUR`: optional per-client, per-route request budgets for the four public AI routes (defaults 10 / 40). Not persisted state; the limiter's windows live in process memory only.
- `PUBLIC_AI_DAILY_LIMIT` (2026-10-20): the site-wide total of model calls the four public AI routes may make together per Asia/Shanghai day (default 500, `PUBLIC_AI_DAILY_LIMIT_DEFAULT` in `src/lib/public-ai-daily-cap.ts`; unset or invalid means the default). Cache hits do not count. Unlike the per-client windows, the count is persisted — `config/public-ai-usage.json` — so a restart keeps the day's total.

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
- `semantic_similar` (2026-10-13) — the local embedding model scores the two
  candidates' title + summary at ≥ 0.96 cosine, at most 3 days apart, neither
  a release-feed item (a `github-release` source or a `/releases/tag/` URL —
  every release feed in the pool arrives as Atom, so until
  `semantic-dedup-v2` on 2026-10-13 the source-type test alone excluded
  nothing). Not computed here: the async refresh after an import
  stores the pairs in `candidate-semantic-matches.json` (each with the model,
  rule version and threshold that produced it — entries under any other are
  ignored) and the synchronous analysis reads them. Measured in
  `eval/dedup/README.md`.

When nothing else separates the members (content score, then the newer
publish date), the default primary is the one imported first.

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
- `intelligenceStatus?`: `draft | reviewed | needs_enrichment` — **workspace
  only**; stripped from the public shape (see below)

This is the shape consumed by the user-facing technology pages.

`intelligenceStatus` is the one field on this list that does **not** reach
public pages. It is an editorial workflow state, not reader content: shipping
it told readers which records the editors consider unfinished. No public
surface ever read it, so it was stripped from the public mapping on
2026-07-28, the same treatment `priority` received on 2026-07-10.
`validate:ranking` asserts the absence (verified to fail when the field is put
back). `translationStatus` and `publisherType` were checked in the same pass
and deliberately **kept**: both are required fields of `TechnologyItem` rather
than optional, and they describe the publisher and the availability of a
translation rather than any editorial judgment about completeness. They were
in the payload without being rendered — a rendering gap, not a boundary
problem — and that gap was closed unevenly on 2026-07-29, because measuring the
two fields showed they are not the same kind of thing:

- **`publisherType` is rendered.** It reaches the reader as a hairline chip in
  the technology detail page's source row (`SourceReference`'s optional
  `publisherTypeLabel` prop, filled by the previously unused
  `getPublisherTypeLabel`). It carries real signal: the distribution stays
  spread across all five values as the pool grows — big-tech 12 / startup 9 /
  open-source-community 6 / research-lab 2 / media 2 at n=31 on 2026-07-29,
  and big-tech 13 / startup 12 / open-source-community 8 / research-lab 2 /
  media 2 at n=37 on 2026-08-07 — and "this came from a vendor announcement
  vs. an open-source release vs. a research lab" changes how a reader
  calibrates the claim. In `original` reading mode it renders the raw enum,
  matching what `getTechnologyTypeLabel` already does for the hero's type line.
- **`translationStatus` is not rendered, and is workspace bookkeeping.** Two
  measurements decided this. First, the stored value **had drifted**: 6 of the
  31 published signals said `pending` while carrying a complete Chinese title,
  summary, and body (2 workspace records + 4 seed records; all corrected on
  2026-07-29), so rendering the stored field would have shown readers a false
  claim. Second, the truthful alternative — the derived
  `getTechnologyTranslationCoverage`, which computes coverage from the content
  actually present — returns `full` for **every** published signal (re-measured
  2026-08-07 at n=37, in both the `preview` and `detail` contexts), so a badge
  built on it would print an identical sentence on every page. That is
  decoration with no signal, the same failure mode the design system already
  rejected for content-kind card spines. The field stays in the type (it is
  required, and editors do use it), but no public surface reads it; treat it as
  workspace state whose value should track the derived coverage.

  **The drift recurs, and nothing in the workflow prevents it.** A
  consistency sweep on 2026-08-07 found the same defect back on **2 of 37**
  records — `lfm2-5-2-6b-on-device-agents` (published the day before) and
  `mcp-2-0-stateless-spec` — both saying `pending` while fully translated;
  both corrected. Nothing sets this field automatically, and the publish gate
  does not check it against the derived coverage, so a record acquires its
  Chinese content without the flag ever being updated. **Re-measure it in any
  consistency pass**, or close the loop by having the publish gate warn when
  the stored value disagrees with `getTechnologyTranslationCoverage`.

The already-built but still unwired `TechnologyLanguageIndicators` component
and the `languageStateLabel` copy key are the leftovers of the rejected
language-badge direction. They are kept because a genuinely partial
translation would make them useful again; until such a signal exists, wiring
them in would add a constant.

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

## PushSubscriptionRecord (2026-10-13)

One reader's 「有新信号时提醒我」 subscription
(`src/lib/push-subscriptions.ts`). The only per-reader record the server
keeps, created only when a reader turns alerts on. Stored with the
pushed-signal list in `config/push-subscriptions.json` as
`{ updatedAt, subscriptions: PushSubscriptionRecord[], pushedTechnologyIds: string[] }`
(git-ignored — the endpoints are bearer addresses; one `runtime_configs`
row under SQLite).

- `id` — sha256 of the endpoint, 24 hex characters; derived, adds nothing
- `endpoint` — the URL the browser's push service issued; must be `https`
  on an allowed push service host
- `keys` — `{ p256dh, auth }`: the browser's P-256 public key (65 octets)
  and auth secret (16 octets), base64url
- `topicIds` — followed `TopicTag` ids, sorted; unknown ids are dropped on
  write; an empty list deletes the record
- `createdAt`

Nothing else: no IP, user agent or reading marks; a test pins the key set.
A record changes or goes only when the caller also presents its `auth`, or
when a push service answers 404 / 410. `pushedTechnologyIds` lists signals
that reached at least one subscriber and are never pushed again.

Public answers carry none of these fields (`PublicPushSubscriptionResult`
is `{ subscribed, topicCount }`); the workspace sees
`PushSubscriptionSummary` — `{ total, byTopic: [{ topicId, count }],
pushedSignalCount }`. A push run is a `WorkflowEvent` with `entityType:
"push_run"`, `action: "push.sent" | "push.failed"` and the run's counts
(`PushRunSummary`, including failures grouped by push service hostname and
reason) as metadata.

The notification payload (`PushNotificationPayload`) is
`{ title, body, url, tag }` built from public signal fields only.

## StoredTriageSuggestion

A workspace-only model suggestion for one undecided candidate
(`src/lib/candidate-triage-suggestions.ts`), stored in
`config/candidate-triage-suggestions.json` as
`{ updatedAt, suggestions: Record<candidateId, StoredTriageSuggestion> }`.

- `candidateId`
- `decision`: `publish | review | reject`
- `confidence`: `0..1`
- `reason`: one line, ≤ 160 characters
- `promptVersion`: `TRIAGE_PROMPT_VERSION` at generation time
- `modelName`: the model that answered, as reported by the provider
- `requestedModel`: the model that was asked for — the deduplication key,
  because the two can differ (the mock answers under its own name, and keying
  on `modelName` made every run regenerate everything)
- `providerName`
- `createdAt`

Rules:

- **Advisory only.** Generating suggestions never changes `importStatus`; the
  editor still acts on each candidate.
- Only suggestions whose `promptVersion` equals the current constant are shown.
  The eval number that justifies trusting a suggestion belongs to one prompt
  version, so an older suggestion is treated as absent rather than current.
- A regenerable cache like the three public AI caches, so git-ignored. Under
  the SQLite driver it is one row in `runtime_configs`, keyed by file name
  like the two schedule configs, because it is one object rather than a list.
- Writes re-read the store and merge, never replace.

The evaluation set (`eval/triage/dataset.jsonl`) is **derived data**, not a
store: rebuilt from the git history of `imported-candidates.live.json` joined
to `candidate-review-state.json` at `HEAD`, because the review state keeps only
each decision and never the candidate text. See `eval/triage/README.md`.
Since 2026-10-15 the snapshot, this dataset and `eval/dedup/labels.jsonl` are
local files, not in git: they hold third-party article text and the
repository is public. The snapshot is runtime data like `workflow-events.json`
(written by every import, kept by `backup:data`), and the history the dataset
is rebuilt from lives in a private full-history bundle on the owner's machine.

## TechnologyWorkspaceRecord

Represents the internal workspace version of a technology record.

- inherits `TechnologyItem`
- `sourceCandidateId?`
- `sourceReferences?`
- `createdAt`
- `updatedAt`
- `editorialNotes`
- `aiDraft?` (2026-10-13) — set when 「AI 起草」 wrote the draft:
  `generationMode`, `providerName`, `modelName`, `promptVersion`,
  `generatedAt`, `sourceTextOrigin` (`page | github_release |
candidate_fallback`), `sourceFetchError?`, `tokenUsage?`, `latencyMs`,
  `warnings`. Workspace-only: `toUserFacingTechnologyItem` picks fields by
  name and never copies it. The same run records `candidate.ai_drafted` (or
  `candidate.ai_draft_failed`, with no draft written) as a `WorkflowEvent`.

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
(`skill-workflow.ts` / `knowledge-workflow.ts`, both thin configurations
of `createContentWorkspaceWorkflow` in `content-workspace-workflow.ts`
since 2026-09-28 — they differ only in their enum attributes, their second
related-id list and two sentences of copy). The stores are a
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

## WeeklySummaryRecord (2026-10-13)

The editor-written 本周总结 on a weekly review — the one persisted thing
about a week; the review itself stays derived. `src/lib/weekly-summary.ts`,
stored as `{ updatedAt, records }` in `config/weekly-summaries.json`
(tracked like `daily-digests.json`; one `runtime_configs` row under SQLite,
because the store is one small object).

- `weekKey`: the week's Monday, `YYYY-MM-DD` — the `/digest/weekly/[week]`
  key; only a canonical Monday of a week with at least one shown signal is
  accepted
- `status`: `draft | published`
- `text`: paragraphs and `**bold**` (rendered through `ContentBody`), at
  most 1,200 characters
- `createdAt`, `updatedAt`, `publishedAt?`

Saving creates a `draft` or replaces the text (a `published` record stays
published, as an edited published digest does). Publishing is blocked for
empty text and for text the public internal-copy guard would hide. The AI
draft that may have produced the text is not recorded on the record — only
in `weekly_summary.ai_drafted` workflow events (model, prompt version
`weekly-summary-v1`, tokens). The public reading is
`getPublishedWeeklySummaryText` (text of a published record, nothing else),
used by both weekly-review pages and the weekly RSS.

## RadarEntry / RadarWorkspaceRecord (2026-10-13)

One technology on the `/radar` technology radar — the technology itself
(vLLM, MCP, LoRA), not a release; the published signals are its evidence.
Types in `src/types/radar.ts`.

- `id`, `name`, `slug`
- `quadrant`: `models-training | agents-applications | inference-deployment | tools-methods`
  (模型与训练 / 智能体与应用 / 推理与部署 / 工具与方法)
- `ring`: `adopt | trial | assess | hold` (采用 / 试用 / 评估 / 暂缓, innermost first)
- `ringReason`: one sentence, why it sits in this ring
- `evidenceTechnologyIds`: published technology signals (2–4 by
  convention; the gate blocks zero published and warns outside 2–4)
- `relatedKnowledgeIds`, `relatedSkillIds`
- `history`: `{ date, fromRing?, toRing, reason }[]`, oldest first;
  `fromRing` is absent on the line that put the entry on the radar, and the
  last line's `toRing` equals `ring`

`history` is written only by the workflow: one line on create, one more on
every edit that changes the ring (the editor's change reason, or the ring
reason when none is given), never taken from a request. 「本期新进 / 移动」
is not stored — `deriveRadarChange` in `src/lib/radar.ts` reads it from
history: 本期 is the 30 days ending on the newest history line anywhere on the
radar; 新进 is a first line inside that window and later than the first
edition (the first edition is the baseline); 移动 is a ring at the start of
the window that differs from the ring now.

Seeds live in `src/data/radar.ts` (40 entries, first edition 2026-10-13).
`RadarWorkspaceRecord` adds `status: draft | published`, `createdAt`,
`updatedAt`, stored in `config/radar-workspace.json`
(`src/lib/radar-workflow.ts`) as the same copy-on-write overlay the skill
and knowledge records use: editing a seed copies it (status `published`),
a published record replaces its seed, a draft hides it, a new record shows
once published. Edits record `radar_entry.created` / `.updated` /
`.published` / `.publish_failed` / `.ring_changed` workflow events.

The public shape, `RadarPublicEntry`, is built only by
`toPublicRadarEntries`: `number` (list order: quadrant, ring, then name by
Chinese collation), `name`, `slug`, `quadrant`, `ring`, `ringReason`,
`change` (`new | moved | unchanged`), `movedFrom?`, `evidence` (published
signals' slug, title, publish date), `knowledge` / `skills` (slug, title),
`history`. No status, timestamps or raw ids.

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

`RelationType` has eight values, rendered with the archival-register labels in
`getRelationTypeLabel`: `builds-on` 渊源, `uses` 借助, `explains` 释义,
`requires` 必备, `extends` 延伸, `supersedes` 续作, `supports` 印证,
`related-to` 关联.

`supersedes` 续作 was added 2026-07-27 for the technology evolution line and
means one specific thing: **B is the later release of the same line as A**.
It exists because `extends` 延伸 had already been used for thematic follow-ups
("顺着这条往下读") — of the four technology↔technology `extends` edges at the
time, only one was an actual version succession, so reading `extends` as
succession would have mislabelled three real relations. Keep the two apart:
延伸 is "read this next", 续作 is "this one replaced it".

`findRelationBetween(aId, aType, bId, bType)` in `src/lib/content.ts` looks up
the relation for an unordered pair regardless of which side `LinkRelation`
records as `from`/`to`, falling back to `related-to` when no explicit entry
exists for that pair.

`requires` is the one relation type read **with** its direction: `from`
needs `to` first (the 先读这些 prerequisite chain,
`src/lib/prerequisite-chain.ts`). Until 2026-09-29 the editors saved with
`from` = the entity being edited, so saving a pair from the depended-on side
stored it reversed; measured that day, 2 of the 19 skill/knowledge `requires`
edges were reversed (both from 完成判定与验收信号). Since then the editors
carry an explicit direction for `requires` (我需要先读它 / 它需要先读我,
prefilled from the stored one), flipping it counts as a change, and the two
reversed overrides are fixed by the one-off `scripts/fix-requires-direction.ts`
(dry run by default, `--apply` to write).

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
excluded, titles matching `isDefacementTitle` excluded. `rawPayload`, `originalContent`, `importStatus`, `normalizedType`,
candidate IDs, and duplicate internals never enter the public shape. All
fast-lane surfaces render the fixed 自动聚合 disclaimer.

## SearchDocument (derived) and the search vector cache

`getSearchDocuments()` in `src/lib/search.ts` builds one `SearchDocument`
per published technology, skill and knowledge item: the public result link,
the lower-cased title and haystack keyword search matches against, and the
text that gets embedded (both title languages, summary, tag names, capped at
400 characters). Keyword and semantic search read the same documents, so they
can disagree about ranking but never about what exists. Not persisted.

`.cache/search-embeddings.json` (git-ignored) caches one vector per document,
keyed by a hash of the embedded text and tagged with the model name, so an
edited item is re-embedded and an unchanged one never is; a different model
invalidates the whole file. `.cache/models/` holds the downloaded model.
Both are regenerable and hold nothing that is not already public. News items
are not embedded.

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

## TechnologyEvolutionChain (derived)

Represents the version line rendered on `/technologies/[slug]` — a pure
derived view computed by `getTechnologyEvolutionChain(technologyId)` in
`src/lib/technology-evolution.ts`, not a persisted entity.

- `steps`: `{ id, slug, title, publishDate, isCurrent, note? }[]`
- `currentIndex`: where the current technology sits in `steps`
- `laterCount`: how many steps come after it

Build rules:

- only `supersedes` relations between two **published** technologies are
  considered; every other relation type is ignored
- the component is walked transitively and treated as **undirected** — the
  stored `from`/`to` direction is not trusted (relations are keyed by unordered
  pair project-wide), so `steps` is ordered by `publishDate` ascending, with
  the slug as a stable tie-breaker
- self-references and edges pointing at an unknown/unpublished technology are
  dropped; a chain of fewer than two technologies returns `undefined` (the page
  renders no section at all)
- a relation `note` is attached to the **newer** side of its pair, so it reads
  as "what this release carried forward"

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
12. optionally send published digest to workspace-configured webhook, Feishu, Telegram or Discord channels
13. optionally run local scheduled delivery for published digests
14. user-facing display

The implementation now supports this lifecycle through local JSON workflow state.

Configured sources now sit before the external source step and can be managed at `/workspace/sources`.

## Duplicate detection v1

Current rules:

- same normalized source URL
- same canonical link from raw RSS / Atom / official blog payloads
- highly similar normalized title token overlap — across two different
  sources (`sourceId`, else `sourceName`) only when both titles carry at
  least three comparison tokens and, if both name a dotted version
  (`v5.13.1`, `2026.6.16`), they share one (2026-10-13; within one source
  unchanged)
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
- related items with no relation type, which would render as the fallback
  关联 (`untyped-relations`, 2026-10-12)
- every topic tag one of the three broad topics, AI 智能体 / 前沿模型 /
  推理与部署 (`broad-topics-only`, 2026-10-12)
- `translationStatus` disagreeing with the coverage derived from the
  content
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
- `radar-workspace.json` (2026-10-13)
- `link-relation-workspace.json`
- `duplicate-groups.json`
- `daily-digests.json`
- `weekly-summaries.json` (2026-10-13; tracked, editorial content; a
  `runtime_configs` row under SQLite)
- `delivery.json`
- `scheduled-delivery.json`
- `scheduled-import.json`
- `scheduled-digest.json`
- `task-runner.json`
- `workflow-events.json`
- `editorial-enrichment-suggestions.json`
- `candidate-triage-suggestions.json`
- `candidate-semantic-matches.json` (2026-10-13; regenerable, git-ignored; a
  `runtime_configs` row under SQLite)
- `push-subscriptions.json` (2026-10-13; reader alert subscriptions,
  git-ignored; a `runtime_configs` row under SQLite)
- `public-ai-usage.json` (2026-10-20; today's public AI model calls against
  the site-wide daily cap — `{ day, total, byRoute, updatedAt }`, the day in
  Asia/Shanghai; a record from another day reads as zero and is replaced by
  the next counted call; git-ignored; a `runtime_configs` row under SQLite)
- `technology-comparisons.json`
- `technology-explanations.json`
- `technology-learning-paths.json`

This local JSON boundary is for local development and controlled single-operator environments. It is not a multi-user database, does not provide transaction isolation, and is not an appropriate production secret store.

The file-level read/write mechanics are centralized in `src/lib/repositories/local-json-store.ts`. Since 2026-09-24 a write is temp-file-then-rename in the same directory (a crash or a concurrent reader never sees a truncated store; on Windows the rename is retried briefly when another process holds the file), and a store file that exists but does not parse **throws** `LocalJsonStoreError` instead of being read as the fallback — every store is read-modify-write of the whole file, so the old behaviour would have replaced a damaged store with an empty one on the next save. A missing file still reads as the fallback. Workflow modules own domain transitions:

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
- `radar_workspace_records` (2026-10-13; same columns as the two above)
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
