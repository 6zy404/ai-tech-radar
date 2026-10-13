import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  buildContentDetailMetadata,
  ContentDetailPage,
  knowledgeDetailKind
} from "@/components/content-detail-page";
import { JsonLd } from "@/components/json-ld";
import { getKnowledgeBySlug, getTagsByIds } from "@/lib/content";
import type { Locale } from "@/lib/i18n/locale";
import { localizeTags } from "@/lib/i18n/topic-names";
import { buildContentJsonLd } from "@/lib/structured-data";

export interface KnowledgeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateKnowledgeDetailPageMetadata(
  locale: Locale,
  { params }: KnowledgeDetailPageProps
): Promise<Metadata> {
  const { slug } = await params;

  return buildContentDetailMetadata(
    knowledgeDetailKind,
    slug,
    getKnowledgeBySlug(slug),
    locale
  );
}

export async function KnowledgeDetailPage({
  params,
  locale
}: KnowledgeDetailPageProps & { locale: Locale }) {
  const { slug } = await params;
  const knowledge = getKnowledgeBySlug(slug);

  if (!knowledge) {
    notFound();
  }

  return (
    <>
      <ContentDetailPage
        kind={knowledgeDetailKind}
        item={knowledge}
        locale={locale}
      />
      <JsonLd
        data={buildContentJsonLd(
          "knowledge",
          knowledge,
          localizeTags(getTagsByIds(knowledge.tags), locale),
          undefined,
          locale
        )}
      />
    </>
  );
}
