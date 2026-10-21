# LLM Provider Integration v0

LLM Provider Integration v0 adds optional provider-backed drafting to the existing workspace-only Editorial Enrichment flow.

It does not publish model output. It only creates `EditorialEnrichmentSuggestion` records. Editors must review and apply a suggestion before any generated fields are copied into `TechnologyWorkspaceRecord`; publication still requires the normal Publish Quality Gate.

That was the only caller when this page was written (2026-06). It is no longer: the same provider configuration now serves the callers below.

## Who calls the provider

**Setting a real `LLM_API_KEY` also opens four public, unauthenticated routes that spend it per request.** Their only cost guards are the per-client rate limit (`PUBLIC_AI_RATE_LIMIT_PER_MINUTE` / `PUBLIC_AI_RATE_LIMIT_PER_HOUR` in `.env.example`, defaults 10 and 40 per route), a site-wide daily total for the four together (`PUBLIC_AI_DAILY_LIMIT`, default 500 model calls per Asia/Shanghai day, 2026-10-20) and, for three of them, a result cache. Review the limit before configuring a real key; the reasoning is in `docs/security-boundary.md` → "Public LLM Feature Boundary".

Public:

- `POST /api/technologies/compare`, `POST /api/technologies/explain`, `POST /api/technologies/learning-path` (`technology-comparison.ts`, `technology-explanation.ts`, `technology-learning-path.ts`): cached per technology pair / technology × level / technology, rate limited.
- `POST /api/ask` (`ask-radar.ts`): no cache — every question calls the model — rate limited with a per-round token cap; streaming and tool calling go through `src/lib/llm/chat-stream.ts`.

Workspace (behind the workspace guard, absent from `npm run build:public`):

- Editorial Enrichment, this page (`editorial-enrichment.ts`, `/api/workspace/technologies/[id]/enrichment/generate`).
- Triage suggestions (`candidate-llm-triage.ts`, `/api/workspace/triage-suggestions`).
- 「AI 起草」 (`candidate-llm-draft-workflow.ts`, `/api/workspace/candidates/[id]/ai-draft`).
- 「AI 起草导语」 for digests (`digest-ai-summary.ts`, `/api/workspace/digests/[date]/ai-summary`) and weekly summaries (`weekly-summary-workflow.ts`, `/api/workspace/weekly-summaries/[week]/ai-summary`).

## Providers

Supported providers:

- `mock`: local deterministic mock provider for development and validation. It requires no API key.
- `openai_compatible`: server-side chat-completions provider configured by environment variables.

DeepSeek is in use today through `openai_compatible` (`LLM_BASE_URL=https://api.deepseek.com`, `LLM_MODEL=deepseek-chat`; see `.env.example`).

Reserved future providers include OpenAI first-party naming, Claude, Ollama, OpenRouter, delivery-specific summarizers, and other adapters. They should be added behind the provider interface, not inside UI components or workflow code.

## Environment

```bash
LLM_PROVIDER=mock
LLM_API_KEY=
LLM_BASE_URL=https://api.openai.com/v1
LLM_MODEL=gpt-4o-mini
LLM_TIMEOUT_MS=15000
```

Fallback rules:

- if `LLM_PROVIDER` is unset, the workspace uses safe local behavior
- if `LLM_PROVIDER=openai_compatible` but `LLM_API_KEY` is missing, the workflow falls back to `mock`
- validation and build do not require a real external API key
- all provider calls happen server-side in workflow/API code

## Code Boundary

Provider files:

- `src/lib/llm/provider.ts`: shared provider interfaces and environment config
- `src/lib/llm/providers/mock.ts`: local mock provider
- `src/lib/llm/providers/openai.ts`: OpenAI-compatible chat-completions adapter
- `src/lib/llm/providers.ts`: configured provider factory
- `src/lib/llm/chat-stream.ts`: streaming chat with tool calling, for 问雷达
- `src/lib/llm/chat-clients.ts`: the 问雷达 chat client factory, with a search-only mock when no key is set
- `src/lib/llm/prompts/editorial-enrichment.ts`: centralized prompt template
- `src/lib/llm/editorial-enrichment-output.ts`: output parser, validator, and sanitizer
- `src/lib/llm/technology-comparison-output.ts`, `technology-explanation-output.ts`, `technology-learning-path-output.ts`: output parsers for the three public cached features

The workspace UI only selects a generation mode and calls the internal API route. It never reads `LLM_API_KEY` and never constructs prompts.

## Prompt Version

The editorial enrichment prompt is stored as an internal `PromptVersion` with:

- `purpose = editorial_enrichment`
- `status = active | draft | deprecated`
- a versioned prompt template
- an output schema used by the provider prompt

The generation workflow loads the active prompt version. If no prompt version store exists, it creates the default active prompt locally. Every suggestion stores `promptVersionId` and the readable prompt version string so later review can trace which prompt produced the output.

The prompt template includes:

- title, summary, and content excerpt
- source and publisher
- tags
- priority level and reasons
- source language
- related knowledge and skills
- existing Content Intelligence fields

The prompt asks for JSON fields:

- `whyItMatters`
- `whoShouldCare`
- `technicalContext`
- `impactAreas`
- `learningPath`
- `relatedKnowledgeExplanations`
- `relatedSkillExplanations`
- `followUpQuestions`
- `readingDifficulty`
- `confidence`
- `limitations`

The template explicitly instructs the model not to invent unsupported source facts and to use `limitations` when evidence is insufficient.

The three public cached features keep their prompts the same way, under their
own purposes (`technology_comparison`, `technology_explanation`,
`technology_learning_path`), each with a purpose-specific default. The newer
callers do not use the store at all: 问雷达 (`ASK_PROMPT_VERSION`,
`ASK_FOLLOWUP_PROMPT_VERSION`), triage (`TRIAGE_PROMPT_VERSION`), 「AI 起草」
(`CANDIDATE_DRAFT_PROMPT_VERSION`) and the two 「AI 起草导语」 prompts
(`DIGEST_SUMMARY_PROMPT_VERSION`, `WEEKLY_SUMMARY_PROMPT_VERSION`) are code
constants beside their prompt text, recorded on every result and workflow
event, so a number from `eval:ask` or `eval:triage` stays tied to the prompt
it measured, and a triage suggestion from an older version is treated as
absent rather than current.

## Output Validation

LLM output is parsed and sanitized before storage:

- invalid JSON is rejected with a structured error
- unsupported fields are ignored with warnings
- internal-only fields or terms fail validation
- string and array lengths are capped
- related knowledge/skill explanation maps are limited to linked IDs
- `readingDifficulty` must be `beginner`, `intermediate`, or `advanced`
- `confidence` is clamped to `0..1`

Failed generations can still create a workspace-only suggestion record with `outputValidationStatus = failed` and `generationError`, so editors can see what happened without crashing the page.

## Suggestion Metadata

`EditorialEnrichmentSuggestion` now supports:

- `generationMode`: `rule_based | llm_assisted | mock_llm`
- `providerName`
- `modelName`
- `promptVersionId`
- `promptVersion`
- `outputValidationStatus`
- `outputValidationWarnings`
- `confidence`
- `limitations`
- `tokenUsage`
- `generationError`
- `reviewStatus`
- `qualityScore`
- `qualityLabels`
- `reviewerNotes`
- `rejectionReason`
- `appliedFields`

These fields are internal-only and must not appear on user-facing technology pages, digest pages, or public feeds.

## Workspace Flow

In `/workspace/technologies/[id]`, editors can choose:

- Rule-based suggestion
- LLM-assisted suggestion
- Mock LLM suggestion

Generation stores a suggestion only. Editors can save quality review metadata before applying. Apply all copies every generated field into the draft and marks the suggestion accepted. Apply selected copies only chosen fields and marks the suggestion partially accepted. Reject stores reviewer notes plus a rejection reason and leaves the draft unchanged. Regeneration keeps old suggestions and can mark older drafts stale when inputs changed.

## Security Boundary

- API keys are read only from server-side environment variables.
- API keys are not passed to client components.
- The prompt uses a content excerpt and safe metadata, not raw payloads or delivery credentials.
- Workflow events store provider/model/status metadata, not API keys or request headers.
- User-facing pages never render provider metadata, prompt versions, token usage, generation errors, reviewer notes, or source inputs.

## Validation

Run:

```bash
npm run validate:llm-enrichment
```

It verifies mock generation, no-key fallback, rule-based generation, output validation, invalid JSON handling, apply/reject boundaries, public-field isolation, and failed-generation WorkflowEvent recording.

## Later Work

- production-grade multi-provider adapters
- prompt version migration and A/B review
- batch generation
- richer prompt comparison and A/B review
- cost accounting beyond the site-wide daily call count
  (`PUBLIC_AI_DAILY_LIMIT`, 2026-10-20) and the optional price figure
  `eval:triage` prints
- quality review of generated suggestions
- secure production secret storage
- human attribution and reviewer ownership
