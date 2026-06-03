# Content Intelligence v1

Content Intelligence v1 adds an explanation layer to published technology content. It helps users understand a technology signal instead of only seeing a title, summary, source, and tags.

This is not impact ranking, recommendation, or personalization. The fields are edited in the Internal Workspace and then published as safe user-facing content.

AI-assisted Editorial Enrichment v0 can now draft these fields with deterministic rule-based templates or an optional server-side LLM provider. Editors must still review and apply the suggestion before it changes a draft.

## Fields

Technology records can include:

- `whyItMatters`: why this technology signal deserves attention.
- `whoShouldCare`: audiences such as AI engineer, product builder, agent developer, infra engineer, researcher, or technical manager.
- `technicalContext`: the trend, stack layer, or technical background this signal belongs to.
- `impactAreas`: affected areas such as agent workflow, model serving, developer tools, retrieval systems, evaluation, or enterprise AI adoption.
- `learningPath`: suggested sequence for reading, evaluating, or piloting the signal.
- `relatedKnowledgeExplanations`: per-knowledge explanation for why each linked knowledge item matters.
- `relatedSkillExplanations`: per-skill explanation for why each linked skill helps.
- `followUpQuestions`: questions that help users continue investigating.
- `readingDifficulty`: `beginner | intermediate | advanced`.
- `intelligenceStatus`: `draft | reviewed | needs_enrichment`.

## Workspace Editing

Editors manage these fields in `/workspace/technologies/[id]` inside the Content Intelligence section of the draft edit form.

The form intentionally uses simple text areas and line-based lists. There is no rich text editor. Optional LLM-assisted drafting is handled by the workspace-only provider layer and falls back to mock generation when no API key is configured.

The same workspace detail page also has an Editorial Enrichment section. It can:

- generate a rule-based suggestion from the current draft, related knowledge, related skills, tags, and priority reasons
- generate an LLM-assisted or mock LLM suggestion through the server-side provider abstraction
- compare current fields with suggested fields
- save human quality review metadata for a suggestion
- apply all generated fields or selected generated fields to the draft
- reject the suggestion with reviewer notes and a rejection reason
- regenerate without deleting older suggestions
- mark older draft suggestions `stale` when source inputs changed

Suggestions are workspace-only. They are stored separately from `TechnologyWorkspaceRecord` until an editor applies them.

Prompt Quality & Editorial Review v1 records which `PromptVersion` produced each suggestion and stores editor feedback such as `reviewStatus`, `qualityScore`, `qualityLabels`, `reviewerNotes`, `rejectionReason`, and `appliedFields`. These fields help improve future prompts but are not published content.

## Publishing

Publishing carries the fields from `TechnologyWorkspaceRecord` into the safe published `TechnologyItem`.

Publish Quality Gate v0 now warns when important explanation fields are empty:

- missing `whyItMatters`
- missing `whoShouldCare`
- missing knowledge explanations
- missing skill explanations
- missing `learningPath`
- missing `followUpQuestions`
- no editorial enrichment suggestion generated
- latest editorial enrichment suggestion generated but not applied or rejected

These are warnings, not blocking errors, so historical or partially enriched content can still be published while editors see that user understanding quality is lower.

## User-Facing Display

`/technologies/[slug]` shows:

- Why it matters
- Who should care
- Technical context
- Impact areas and reading difficulty
- Learning path
- Related knowledge with explanations
- Related skills with explanations
- Follow-up questions

`/technologies` uses a shorter version of the explanation layer so cards help users decide whether to open the detail page.

`/digest/today` and `/digest/[date]` use `whyItMatters`, related skill counts, related knowledge counts, and audience hints to make high-priority digest items read more like a technical brief.

## Boundary With Ranking And Quality

Ranking v0 answers: how urgent is this signal?

Quality Signals answer: is the imported candidate complete enough for review?

Content Intelligence answers: can a user understand what this signal means and what to do next?

Content Intelligence fields are user-facing enrichment. They must not expose raw payloads, import status, duplicate internals, quality flags, workflow events, delivery logs, endpoint URLs, or workspace notes.

`EditorialEnrichmentSuggestion` records are not user-facing content. User-facing pages must not expose generation mode, source inputs, suggestion status, reviewer notes, stale/applied/rejected metadata, or workflow events.
They also must not expose provider names, model names, prompt versions, token usage, generation errors, or API-key-related configuration.
They also must not expose suggestion quality scores, labels, reviewer notes, rejection reasons, applied-field audit data, or prompt version IDs.

## Later Work

- richer multi-provider LLM-assisted drafting with explicit editor review
- prompt quality dashboards and prompt version editing
- automatic knowledge and skill explanation discovery
- richer bilingual explanation fields
- structured learning paths with linked steps
- deeper editorial review status and ownership
