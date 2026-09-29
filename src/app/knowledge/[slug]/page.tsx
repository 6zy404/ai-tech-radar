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

// Reads runtime content through @/lib/content, so it must never be
// prerendered: a build-time copy freezes whatever the workspace had
// published when the build ran and never regenerates
// (initialRevalidateSeconds is false). See CHANGELOG - "Five public pages
// would have shipped frozen at build time".
export const dynamic = "force-dynamic";

interface KnowledgeDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params
}: KnowledgeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  return buildContentDetailMetadata(
    knowledgeDetailKind,
    slug,
    getKnowledgeBySlug(slug)
  );
}

export default async function KnowledgeDetailPage({
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
