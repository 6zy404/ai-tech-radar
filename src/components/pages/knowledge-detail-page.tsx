import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  buildContentDetailMetadata,
  ContentDetailPage,
  knowledgeDetailKind
} from "@/components/content-detail-page";
import { JsonLd } from "@/components/json-ld";
import { getKnowledgeBySlug, getTagsByIds } from "@/lib/content";
import { buildContentJsonLd } from "@/lib/structured-data";

interface KnowledgeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateKnowledgeDetailPageMetadata({
  params
}: KnowledgeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  return buildContentDetailMetadata(
    knowledgeDetailKind,
    slug,
    getKnowledgeBySlug(slug)
  );
}

export async function KnowledgeDetailPage({
  params
}: KnowledgeDetailPageProps) {
  const { slug } = await params;
  const knowledge = getKnowledgeBySlug(slug);

  if (!knowledge) {
    notFound();
  }

  return (
    <>
      <ContentDetailPage kind={knowledgeDetailKind} item={knowledge} />
      <JsonLd
        data={buildContentJsonLd(
          "knowledge",
          knowledge,
          getTagsByIds(knowledge.tags)
        )}
      />
    </>
  );
}
