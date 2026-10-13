import { AskRadar } from "@/components/ask-radar";
import { UserPageShell } from "@/components/user-page-shell";
import { buildAskExamples } from "@/lib/ask-examples";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getAllTechnologies
} from "@/lib/content";
import { askCopy } from "@/lib/i18n/copy/ask";
import type { Locale } from "@/lib/i18n/locale";
import { localizeTags } from "@/lib/i18n/topic-names";
import { buildPageMetadata } from "@/lib/site-metadata";

export function getAskPageMetadata(locale: Locale) {
  const copy = askCopy[locale].page;

  return buildPageMetadata({
    title: copy.title,
    description: copy.description,
    path: "/ask",
    locale
  });
}

export interface AskPageProps {
  searchParams: Promise<{ q?: string }>;
}

export async function AskPage({
  searchParams,
  locale
}: AskPageProps & { locale: Locale }) {
  const copy = askCopy[locale].page;
  // Arriving from /search pre-fills the box but does not ask: a navigation
  // should never spend a model call on its own.
  const { q } = await searchParams;
  const initialQuestion = q?.trim().slice(0, 200) ?? "";
  // Built by fixed rules from what is published now, so they change as the
  // site does and never name something it does not hold.
  const examples = buildAskExamples({
    technologies: getAllTechnologies(),
    knowledge: getAllKnowledge(),
    skills: getAllSkills(),
    tags: localizeTags(getAllTags(), locale),
    locale
  });

  return (
    <UserPageShell
      title={copy.title}
      description={copy.description}
      sectionLabel={copy.sectionLabel}
      className="ask-page dossier"
    >
      <AskRadar examples={examples} initialQuestion={initialQuestion} />
    </UserPageShell>
  );
}
