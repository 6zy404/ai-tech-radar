# AGENTS.md

## Project identity
This project is a platform for helping users quickly understand which new technologies are worth paying attention to first.

It is not a generic news site.
It must connect:
- new technologies
- hot skills
- classic knowledge
- links between new and old concepts

## Current phase
The current phase is foundation building only.

Focus on:
- project structure
- data model
- static pages
- mock data
- documentation

Do not jump ahead into ranking, crawling, push, or recommendation systems.

## Working rules
1. Keep scope tight.
2. Prefer simple and maintainable implementation.
3. Follow existing repository conventions if they already exist.
4. If the repo is empty, use a clean default stack and explain the setup.
5. Reusable components are preferred over repeated page code.
6. User-facing pages must not contain unfinished placeholder text.

## Product rules
1. Do not turn the project into a generic AI news portal.
2. Preserve the distinction between:
   - TechnologyItem
   - SkillItem
   - KnowledgeItem
3. Make relationships between these entities visible in the UI.
4. Use mock data to demonstrate how the platform will work later.

## Non-goals for now
- no ranking engine
- no source ingestion
- no push delivery
- no login system
- no database
- no admin dashboard
- no recommendation engine

## Documentation rules
Whenever you add structure, also document it.
At minimum:
- update README
- explain the data model
- explain page structure

## Project Context Recovery v0

Long-term project context must live in repository documents, not in ChatGPT or
Codex chat history. New sessions should start from:

- `AGENTS.md`
- `README.md`
- `docs/project-spec.md`
- `docs/architecture.md`
- `docs/data-model.md`
- `docs/page-structure.md`
- `docs/design-system.md`
- `docs/security-boundary.md`
- `docs/workspace-actions.md`
- `docs/progress.md`
- `docs/decisions.md`
- `docs/ui-migration-plan.md`
- `docs/next-task.md`

If a detail is not supported by current repository files, mark it as
`Unknown / needs verification` instead of reconstructing it from old chat
history.

Default continuation rules:

- UI work should default to visual-layer changes only unless explicitly scoped
  otherwise.
- Work on one page per task.
- Keep Workspace and User-facing surfaces separate.
- Workspace is the internal editing / operations workbench.
- User-facing pages are the public reading and technology discovery product.
- Do not run Playwright from Codex unless the user explicitly asks; Playwright
  validation is run by the user locally.
- Default Codex verification is `npm run typecheck` unless the task asks for a
  different command.
