# Data Model

This prototype defines five core entity types.

## TechnologyItem

Represents a new technology, product, protocol, model, or workflow worth tracking.

- `id`: Stable internal identifier
- `title`: Human-readable name
- `slug`: URL-safe route key
- `summary`: Short preview text
- `content`: Longer explanation used on the detail page
- `type`: `platform | tool | model | protocol | workflow`
- `publishDate`: Mock publication date in ISO format
- `sourceName`: Mock source label
- `sourceUrl`: Mock source URL
- `publisherName`: Publisher label
- `publisherType`: `big-tech | startup | research-lab | open-source-community | media`
- `importanceLevel`: `signal | important | critical`
- `status`: `watch | learn-first | pilot-later`
- `tags`: Array of `TopicTag.id`
- `relatedKnowledgeIds`: Direct links to `KnowledgeItem`
- `relatedSkillIds`: Direct links to `SkillItem`

## SkillItem

Represents a practice area the user may need in order to apply or evaluate new technologies.

- `id`
- `title`
- `slug`
- `summary`
- `content`
- `skillType`: `engineering | analysis | product | operations | communication`
- `heatLevel`: `emerging | active | hot`
- `learningCost`: `low | medium | high`
- `tags`
- `relatedTechnologyIds`
- `relatedKnowledgeIds`

## KnowledgeItem

Represents a classic or long-lived concept that explains why newer items matter.

- `id`
- `title`
- `slug`
- `summary`
- `content`
- `category`: `machine-learning | software-architecture | data | product-thinking | operations`
- `difficulty`: `foundation | intermediate | advanced`
- `tags`
- `relatedTechnologyIds`
- `relatedSkillIds`

## TopicTag

Simple cross-cutting label used for browsing and grouping.

- `id`
- `name`
- `description`

## LinkRelation

Explicit relation records that add typed connections and human-readable notes between items.

- `id`
- `fromId`
- `fromType`: `technology | skill | knowledge`
- `toId`
- `toType`: `technology | skill | knowledge`
- `relationType`: `builds-on | uses | explains | requires | extends | supports | related-to`
- `note`

## Modeling notes

- Direct arrays such as `relatedKnowledgeIds` and `relatedSkillIds` make page rendering straightforward.
- `LinkRelation` adds richer explanations without forcing page components to infer why two items are connected.
- All data is local mock data in TypeScript files so the structure can later move to JSON, APIs, or a database with minimal UI changes.
