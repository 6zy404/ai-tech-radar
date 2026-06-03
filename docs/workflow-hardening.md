# Database-backed Workflow Hardening v1

This phase strengthens the database-backed workflow without changing the product scope, replacing SQLite, removing JSON fallback, or adding a user system.

The goal is reliability around state transitions: a failed critical step should not silently leave the workflow in a misleading state, and important changes should leave an internal audit trail.

## Covered workflows

Workflow Hardening v1 adds guards, failure events, or audit events around:

- Source import -> ImportedCandidate -> source health update
- Candidate -> Technology draft
- DuplicateGroup resolve -> primary candidate -> references
- Technology draft -> Published TechnologyItem
- DailyDigest generate / regenerate
- DailyDigest publish
- Delivery send -> DeliveryRun
- ScheduledDelivery run -> ScheduledDeliveryRun -> DeliveryRun
- Task runner run-once / watch execution summaries

## Transaction and guard strategy

The SQLite driver currently wraps each store replacement in a transaction. Cross-store workflows still use service-level guards and best-effort compensation because JSON fallback remains supported.

Current hardening behavior:

- Candidate conversion writes the draft first, then marks the candidate converted. If the candidate status write fails, the workflow attempts to restore the prior draft store before rethrowing.
- Repeated candidate conversion returns the existing draft instead of creating a duplicate workspace record.
- Non-primary candidates in a resolved duplicate group cannot be converted into independent drafts.
- Draft publish runs publish readiness checks before writing published state. Slug conflicts block publish.
- Digest publish runs readiness checks before status changes. Digests with unpublished or missing technology references cannot publish.
- Delivery send writes a `DeliveryRun` for both success and failure. A failed send does not disappear.
- Scheduled delivery keeps duplicate protection for the same schedule / digest / channel / local day and records skipped channels in the scheduled run summary.

## WorkflowEvent structure

`WorkflowEvent` is the internal audit structure.

Fields:

- `id`
- `entityType`
- `entityId`
- `action`
- `actorType`
- `actorId`
- `beforeSnapshot`
- `afterSnapshot`
- `metadata`
- `createdAt`

Supported actor types:

- `system`
- `workspace_user`
- `task_runner`

Workflow events are stored in:

- JSON mode: `workflow-events.json`
- SQLite mode: `workflow_events`

They are internal-only and must not appear in user-facing pages, public feeds, or public digest pages.

## Recorded actions

Current event actions include:

- `candidate.status_updated`
- `candidate.converted_to_draft`
- `candidate.convert_failed`
- `duplicate_group.updated`
- `duplicate_group.resolved`
- `draft.updated`
- `draft.published`
- `draft.publish_failed`
- `editorial_enrichment.generated`
- `editorial_enrichment.failed`
- `editorial_enrichment.applied`
- `editorial_enrichment.rejected`
- `editorial_enrichment.stale`
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

## Sanitization

Workflow events sanitize token-like and endpoint-like values before storage. This is a defense-in-depth measure, not a replacement for secret storage.

Sanitized fields include keys containing:

- `endpoint`
- `url`
- `token`
- `secret`
- `signature`
- `authorization`
- `password`
- `key`

Production environments should still keep webhook tokens in a secret manager and enforce a real access control model.

## Workspace visibility

Workspace detail pages show a low-priority event panel for recent related state changes:

- candidate detail
- technology draft detail
- digest detail
- delivery workspace
- scheduled delivery workspace

The event panel is intentionally secondary. It exists to help editors and maintainers diagnose state transitions, not to become the primary content.

## Operations visibility

Observability & Admin Operations v0 reuses `WorkflowEvent`, source health, import runs, delivery runs, scheduled-delivery runs, task-runner runs, duplicate groups, and candidate quality signals to build an internal operations dashboard.

Routes:

- `/workspace/operations`
- `/workspace/operations/events`

The operations dashboard is read-only with respect to core workflows. It does not change import, conversion, publish, digest, delivery, schedule, or task-runner behavior. It summarizes existing records into health state, attention-required items, failed import/delivery/schedule views, quick links, and recent activity.

The event browser lets maintainers filter WorkflowEvent records by entity type, action, and actor type. Long snapshots are truncated and endpoint/token-like values are sanitized before rendering. Operations and event views are internal-only and must not appear in user-facing pages, public feeds, or public digest pages.

## Remaining limits

Still left for later:

- true cross-store ACID transactions across candidate, draft, digest, delivery, and schedule stores
- database-native unique constraints for all duplicate-sensitive workflows
- row-level locks or job locks for concurrent task runners
- event retention and archival policy
- full audit actor identity after a real user system exists
- production observability and alerting
- external monitoring integration, alert routing, and event retention policy
- recovery tooling for manually replaying or rolling back failed workflows
