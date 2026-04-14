# Page Structure

This prototype uses the Next.js App Router and keeps each page focused on static local rendering.

## Routes

- `/`
  - Home page with platform intro and four visible sections:
    - Today First
    - New Technology Feed
    - Hot Skills
    - Classic Knowledge
- `/technologies`
  - Technology list page with search input, type filter, and tag filter
- `/technologies/[slug]`
  - Technology detail page with summary, source info, publisher info, tags, related skills, and related knowledge
- `/skills`
  - Skill list page
- `/skills/[slug]`
  - Skill detail page
- `/knowledge`
  - Knowledge list page
- `/knowledge/[slug]`
  - Knowledge detail page

## Reusable components

- `PageShell`
  - Standard page heading and framing
- `TopNav`
  - Shared site navigation
- `ContentCard`
  - Shared list card used across home, technology, skills, and knowledge pages
- `TagBadge`
  - Small visual label for topic tags
- `RelationList`
  - Shared linked list for skills, knowledge, and technology relationships
- `SearchFilterBar`
  - Search and filter controls for the technology list

## Data flow

- Mock content lives in `src/data`.
- Helper lookups live in `src/lib/content.ts`.
- Pages import typed mock data through the helper layer instead of reaching into multiple data files directly.
- Search and filter state is client-side only and limited to the technology list page.

## Intentional limits

- No server-side data fetching
- No persistent state
- No login or user-specific views
- No ranking or recommendation logic
- No ingestion pipelines or admin workflows
