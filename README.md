# AI Tech Radar Prototype

This repository contains a local-only prototype for an AI tech radar product. The goal is to help users quickly see which new technologies are worth understanding first, while also surfacing the hot skills and classic knowledge that explain them.

## What this prototype currently does

- Provides a simple Next.js + TypeScript project foundation.
- Defines core data models for technologies, skills, knowledge items, topic tags, and explicit link relations.
- Uses local mock data to show how new items connect to older concepts and practical skills.
- Renders static pages for the home page, technology list, technology detail, skills, and knowledge.
- Includes reusable UI components for layout, navigation, cards, tag badges, relation lists, and search/filter controls.

## What is intentionally not implemented yet

- Real crawling, RSS ingestion, or API ingestion
- Ranking logic or scoring systems
- Push notifications
- User login or user accounts
- Database integration
- Admin panel
- Analytics
- Recommendation systems

## Local run

1. Install dependencies:

```bash
npm install
```

2. Start the local development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000).

## Useful commands

```bash
npm run typecheck
npm run build
```

## Project structure

- `src/app`: App Router pages and global styles
- `src/components`: Reusable UI components
- `src/data`: Mock data records
- `src/lib`: Data lookup helpers
- `src/types`: Shared TypeScript models
- `docs`: Supporting documentation for data and page structure
