import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  buildContentDetailMetadata,
  ContentDetailPage,
  skillDetailKind
} from "@/components/content-detail-page";
import { JsonLd } from "@/components/json-ld";
import { getSkillBySlug, getTagsByIds } from "@/lib/content";
import type { Locale } from "@/lib/i18n/locale";
import { localizeTags } from "@/lib/i18n/topic-names";
import { buildContentJsonLd } from "@/lib/structured-data";

export interface SkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateSkillDetailPageMetadata(
  locale: Locale,
  { params }: SkillDetailPageProps
): Promise<Metadata> {
  const { slug } = await params;

  return buildContentDetailMetadata(
    skillDetailKind,
    slug,
    getSkillBySlug(slug),
    locale
  );
}

export async function SkillDetailPage({
  params,
  locale
}: SkillDetailPageProps & { locale: Locale }) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);

  if (!skill) {
    notFound();
  }

  return (
    <>
      <ContentDetailPage kind={skillDetailKind} item={skill} locale={locale} />
      <JsonLd
        data={buildContentJsonLd(
          "skill",
          skill,
          localizeTags(getTagsByIds(skill.tags), locale),
          undefined,
          locale
        )}
      />
    </>
  );
}
