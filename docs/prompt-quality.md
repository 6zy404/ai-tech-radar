# Prompt Quality & Editorial Review v1

Prompt Quality & Editorial Review v1 adds a workspace-only review loop around Editorial Enrichment suggestions.

The goal is not to let an LLM publish content. The goal is to record which prompt version produced a suggestion, let an editor judge the generated fields, and keep enough feedback to improve the prompt later.

## Scope

This layer applies to `EditorialEnrichmentSuggestion` records for Content Intelligence fields on `TechnologyWorkspaceRecord`.

It does not affect Ranking v0, source quality, candidate quality, delivery, or user-facing publication by itself.

## PromptVersion

`PromptVersion` stores the prompt contract used for editorial enrichment generation:

- `id`
- `name`
- `purpose`: currently `editorial_enrichment`
- `version`
- `status`: `active | draft | deprecated`
- `template`
- `outputSchema`
- `createdAt`
- `updatedAt`
- `notes?`

The active prompt is loaded from the local `prompt-versions.json` store. If the store is empty, the workflow creates the default editorial enrichment prompt version and records `prompt_version.created`.

Generation uses the active prompt version and stores `promptVersionId` plus the human-readable prompt `version` on every suggestion. Old suggestions remain inspectable even if a prompt version is later deprecated.

Prompt templates are internal workflow assets. They must not be rendered on user-facing technology pages, digest pages, or feeds.

## Suggestion Review Fields

`EditorialEnrichmentSuggestion` supports manual quality review:

- `reviewStatus`: `unreviewed | accepted | partially_accepted | rejected`
- `qualityScore`: optional `1..5` editor score
- `qualityLabels`: `accurate | clear | too_generic | too_verbose | missing_context | hallucination_risk | needs_human_edit | good_enough`
- `reviewerNotes`
- `rejectionReason`
- `appliedFields`
- `reviewedAt`

These fields are workspace-only. They are used to judge generated suggestions, not to rank technologies.

## Review Workflow

The workspace technology detail page supports:

- generating a new suggestion using rule-based, mock LLM, or optional LLM-assisted generation
- seeing prompt version, provider, model, validation warnings, limitations, confidence, and status metadata
- switching between historical suggestions for the same draft
- comparing current Content Intelligence fields against suggested fields
- saving quality score, labels, and reviewer notes without applying the suggestion
- applying all generated fields
- applying selected fields only
- rejecting a suggestion with a rejection reason

Apply all sets `reviewStatus = accepted`. Apply selected fields sets `reviewStatus = partially_accepted` when not all generated fields are applied. Reject sets `reviewStatus = rejected` and does not change the technology draft.

Regeneration keeps older suggestions. If source inputs changed, older draft suggestions are marked `stale` rather than overwritten.

## Workflow Events

The workflow records low-weight internal events:

- `prompt_version.created`
- `enrichment_suggestion.generated`
- `enrichment_suggestion.reviewed`
- `enrichment_suggestion.applied`
- `enrichment_suggestion.rejected`
- `enrichment_suggestion.marked_stale`

Events do not store API keys, full request headers, or complete sensitive prompt inputs.

## User-Facing Boundary

User-facing pages may show Content Intelligence fields after an editor applies them and publishes the technology item.

User-facing pages must not show:

- `PromptVersion`
- `promptVersionId`
- `promptVersion`
- `reviewStatus`
- `qualityScore`
- `qualityLabels`
- `reviewerNotes`
- `rejectionReason`
- `appliedFields`
- `sourceInputs`
- provider or model names
- token usage
- generation errors
- WorkflowEvent / AuditLog records

## Validation

Run:

```bash
npm run validate:prompt-quality
```

It verifies active prompt version usage, suggestion prompt-version recording, review metadata persistence, selected-field apply behavior, rejection behavior, stale suggestion history, WorkflowEvent recording, and user-facing internal-field isolation.

Playwright UI checking remains a manual local validation step:

```powershell
npm run ui:check
```

Codex sandbox runs may fail to launch Chromium with `spawn EPERM`; in that case mark Playwright as manual validation pending and run the command from the local PowerShell terminal.

## Later Work

- prompt editing UI
- prompt A/B testing
- multi-model comparison
- batch suggestion generation
- automatic quality scoring
- reviewer assignment and ownership
- cost reporting by prompt version and provider
