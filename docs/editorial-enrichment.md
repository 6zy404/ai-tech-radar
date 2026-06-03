# AI-assisted Editorial Enrichment v0

Editorial Enrichment v0 is a workspace-only assistant layer for Content Intelligence. It helps editors draft explanation fields, but it does not publish content.

LLM Provider Integration v0 adds optional provider-backed drafting. The default remains safe local behavior: rule-based generation and mock LLM generation work without a real API key.

## Data Structure

`EditorialEnrichmentSuggestion` stores one generated suggestion for one technology draft:

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
- `reviewedAt`
- `appliedAt`
- `rejectedAt`
- `reviewerNotes`
- `reviewStatus`: `unreviewed | accepted | partially_accepted | rejected`
- `qualityScore?`: editor score from `1..5`
- `qualityLabels?`
- `rejectionReason?`
- `appliedFields?`

`generatedFields` can include:

- `whyItMatters`
- `whoShouldCare`
- `technicalContext`
- `impactAreas`
- `learningPath`
- `relatedKnowledgeExplanations`
- `relatedSkillExplanations`
- `followUpQuestions`
- `readingDifficulty`

`sourceInputs` records the draft inputs used for generation, including title, summary, content preview, source, publisher, tags, priority reasons, related knowledge, related skills, and an input signature.

## Workflow

1. Editor opens `/workspace/technologies/[id]`.
2. Editor generates an enrichment suggestion.
3. The system stores the suggestion separately from the technology draft.
4. Editor compares current fields with suggested fields.
5. Editor records quality score, labels, and reviewer notes if useful.
6. Editor applies all fields, applies selected fields, or rejects the suggestion.
7. Apply writes only the selected generated fields into `TechnologyWorkspaceRecord`.
8. Reject stores reviewer notes and a rejection reason, then leaves the draft unchanged.
9. Regenerate creates a new suggestion and marks older draft suggestions `stale` when source inputs changed.

Every generate / apply / reject / stale transition records a `WorkflowEvent` for internal audit.

Prompt Quality & Editorial Review v1 also records `promptVersionId`, `reviewStatus`, `qualityScore`, `qualityLabels`, `rejectionReason`, `appliedFields`, and `reviewedAt`. Apply all marks a suggestion `accepted`; apply selected fields marks it `partially_accepted`; reject marks it `rejected`.

## Generation Rules

Generation modes:

- `rule_based`: deterministic local templates, no provider call.
- `mock_llm`: local mock provider, no API key.
- `llm_assisted`: OpenAI-compatible provider when configured; otherwise safely falls back to `mock_llm`.

Rule-based generation is deterministic and template-based:

- priority reasons help draft `whyItMatters`
- tags, type, related skills, and related knowledge infer audience and impact areas
- related knowledge and skills produce explanation maps
- source and related context produce a learning path
- content length and context infer reading difficulty

LLM-assisted generation uses centralized provider, prompt, and output-validation modules under `src/lib/llm/*`. Model output is parsed as JSON, sanitized, and rejected if it contains internal-only fields or invalid structure.

Failed LLM output is stored as a failed suggestion with a readable `generationError`; it cannot be applied.

Generation uses the active `PromptVersion` for `editorial_enrichment`. If no prompt version store exists, the default active prompt is created locally. Every suggestion stores the prompt version id so old suggestions remain traceable after prompt changes.

## Publish Quality Gate

Publish readiness warns when:

- no enrichment suggestion exists
- the latest suggestion is still `draft` or `stale`
- `whyItMatters` is empty
- related knowledge explanations are empty
- related skill explanations are empty
- `learningPath` is empty

These are warnings, not blocking errors. Editors can publish older or partially enriched content while seeing the quality risk.

## User-facing Boundary

User-facing pages may show applied Content Intelligence fields because they are edited content. They must not show:

- `EditorialEnrichmentSuggestion`
- `generationMode`
- `sourceInputs`
- suggestion status
- `reviewerNotes`
- `reviewStatus`
- `qualityScore`
- `qualityLabels`
- `rejectionReason`
- `appliedFields`
- stale/applied/rejected metadata
- WorkflowEvent / AuditLog entries
- provider name
- model name
- prompt version
- token usage
- generation errors

## Later Work

- richer real provider adapters behind explicit review
- richer diff display for field-level review
- richer bilingual explanation suggestions
- ownership and assignment for enrichment review
- better diffing for stale suggestions
- prompt version editing UI, A/B review, and cost accounting
