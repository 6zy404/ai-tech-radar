import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  buildContentDetailMetadata,
  ContentDetailPage,
  skillDetailKind
} from "@/components/content-detail-page";
import { JsonLd } from "@/components/json-ld";
import { getSkillBySlug, getTagsByIds } from "@/lib/content";
import { buildContentJsonLd } from "@/lib/structured-data";

interface SkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateSkillDetailPageMetadata({
  params
}: SkillDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  return buildContentDetailMetadata(
    skillDetailKind,
    slug,
    getSkillBySlug(slug)
  );
}

export async function SkillDetailPage({ params }: SkillDetailPageProps) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);

  if (!skill) {
    notFound();
  }

  return (
    <>
      <ContentDetailPage kind={skillDetailKind} item={skill} />
      <JsonLd
        data={buildContentJsonLd("skill", skill, getTagsByIds(skill.tags))}
      />
    </>
  );
}
