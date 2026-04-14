# Task 01 - Build the project foundation

## Background
This project is not a generic AI news site.
It is a platform for helping users quickly identify which new technologies are worth understanding first.

The platform should cover:
- new technologies
- new products
- hot skills
- classic concepts and old knowledge
- links between new things and old concepts

However, for this task, do NOT implement ranking logic, crawling, push notifications, or recommendation systems.

## Goal of this task
Build a solid and visible foundation for the project.

This task must produce a working local prototype with:
1. clear project structure
2. core data models
3. mock data
4. static pages
5. reusable UI components
6. basic documentation

## Scope
You must only implement the following parts.

### A. Core data model
Design data structures for these entities:
- TechnologyItem
- SkillItem
- KnowledgeItem
- TopicTag
- LinkRelation

Each entity should have clear fields and types.

Suggested minimum fields:

#### TechnologyItem
- id
- title
- slug
- summary
- content
- type
- publishDate
- sourceName
- sourceUrl
- publisherName
- publisherType
- importanceLevel
- status
- tags
- relatedKnowledgeIds
- relatedSkillIds

#### SkillItem
- id
- title
- slug
- summary
- content
- skillType
- heatLevel
- learningCost
- tags
- relatedTechnologyIds
- relatedKnowledgeIds

#### KnowledgeItem
- id
- title
- slug
- summary
- content
- category
- difficulty
- tags
- relatedTechnologyIds
- relatedSkillIds

#### TopicTag
- id
- name
- description

#### LinkRelation
- id
- fromId
- fromType
- toId
- toType
- relationType
- note

### B. Mock data
Create sample mock data files with at least:
- 8 TechnologyItem records
- 6 SkillItem records
- 8 KnowledgeItem records
- enough tags and relations to demonstrate linking

Use realistic but clearly mock/demo content.

### C. Static pages
Build these pages with mock data only:

1. Home page
   - platform title
   - short intro
   - section: Today First
   - section: New Technology Feed
   - section: Hot Skills
   - section: Classic Knowledge

2. Technology list page
   - card list
   - basic filters by type and tag
   - simple search input
   - each card links to detail page

3. Technology detail page
   - title
   - summary
   - source info
   - publisher info
   - tags
   - related skills
   - related knowledge

4. Skills page
   - skill list
   - simple detail area or detail page

5. Knowledge page
   - knowledge list
   - simple detail area or detail page

### D. Reusable UI components
Create reusable components for:
- page layout
- top navigation
- content card
- tag badge
- relation list
- search/filter bar

### E. Documentation
Create:
- README.md
- docs/data-model.md
- docs/page-structure.md

README must include:
- what this prototype currently does
- what is intentionally not implemented yet
- how to run locally

## Non-goals
Do NOT implement:
- real crawling
- RSS or API ingestion
- ranking algorithm
- scoring system
- notification push
- user login
- database integration
- admin panel
- analytics
- recommendation system

## Technical preference
If the repository is empty, prefer a simple and maintainable stack.

Recommended default:
- Next.js
- TypeScript
- simple local JSON or TS mock data
- clean component structure

If there is already an existing stack in the repo, follow the existing stack instead of replacing it.

## Design requirements
- keep the UI clean and simple
- do not over-design
- prioritize readability and maintainability
- use mock data to demonstrate relationships between technologies, skills, and knowledge
- code should be easy to extend later

## Definition of done
This task is complete only if:
1. the project can run locally
2. the main pages render correctly
3. mock data is visible on pages
4. detail pages show related links between items
5. the docs are written
6. no unfinished placeholder text like "TODO" remains in user-facing pages

## Output requirements
When finished:
1. summarize what files were added or changed
2. explain how to start the project locally
3. clearly list what was intentionally left for later