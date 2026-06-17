# AGENTS.md

## Project identity
This project is a platform for helping users quickly understand which new
technologies are worth paying attention to first.

It is not a generic news site.
It must connect:
- new technologies
- hot skills
- classic knowledge
- links between new and old concepts

## Current phase
The project is well past the original foundation phase. It is now a working
local-first prototype with two subsystems:

- **Internal Workspace** — source configuration, real external import, candidate
  review, duplicate resolution, draft editing/enrichment, publishing, daily
  digest editorial workflow, multi-channel delivery, scheduled delivery + local
  task runner, and an operations/observability dashboard.
- **User-facing Product** — public home, technology list/detail pages, published
  Daily Digest pages, skills/knowledge pages, and public RSS/JSON feeds.

What is implemented today is described in `README.md`, and the version-by-version
history lives in `CHANGELOG.md`. Treat those two files as the source of truth for
"what already exists" before starting new work.

## What is intentionally NOT implemented yet
These remain out of scope and should not be added without an explicit request:

- AI black-box / personalized ranking and recommendation
- login / user accounts / RBAC
- production database integration and schema migrations
- full admin platform and external monitoring/alerting
- push / email subscription products and production cron infrastructure
- full-site i18n (bilingual support stays at the content level only)
- semantic/AI duplicate detection beyond the current deterministic rules
- production secret management and distributed scheduling

The current SQLite driver is an optional local persistence option; JSON remains
the default store. The local JSON store does not provide multi-writer locking,
role-based permissions, or production secret handling.

## Working rules
1. Keep scope tight; do not expand a task beyond what was asked.
2. Prefer simple and maintainable implementation.
3. Follow existing repository conventions.
4. Reusable components are preferred over repeated page code.
5. User-facing pages must not contain unfinished placeholder text.
6. Keep the Internal Workspace and User-facing surfaces separate.
   - Workspace is the internal editing / operations workbench.
   - User-facing pages are the public reading and discovery product.
7. Never leak internal-only fields (raw payloads, import status, normalized type,
   duplicate internals, delivery endpoints, schedules, task-runner logs, workflow
   audit events, or workspace tokens) onto user-facing pages or public feeds.

## Product rules
1. Do not turn the project into a generic AI news p