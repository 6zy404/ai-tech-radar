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
