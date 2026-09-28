import { notFound } from "next/navigation";
import type { Metadata } from "next";

import {
  buildContentDetailMetadata,
  ContentDetailPage,
  skillDetailKind
} from "@/components/content-detail-page";
import { getSkillBySlug } from "@/lib/content";

// Reads runtime content through @/lib/content, so it must never be
// prerendered: a build-time copy freezes whatever the workspace had
// published when the build ran and never regenerates
// (initialRevalidateSeconds is false). See CHANGELOG - "Five public pages
// would have shipped frozen at build time".
export const dynamic = "force-dynamic";

interface SkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params
}: SkillDetailPageProps): Promise<Metadata> {
  const { slug } = await params;

  return buildContentDetailMetadata(
    skillDetailKind,
    slug,
    getSkillBySlug(slug)
  );
}

export default async function SkillDetailPage({
  params
}: SkillDetailPageProps) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);

  if (!skill) {
    notFound();
  }

  return <ContentDetailPage kind={skillDetailKind} item={skill} />;
}
