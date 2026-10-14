import {
  generateSkillDetailPageMetadata,
  SkillDetailPage,
  type SkillDetailPageProps
} from "@/components/pages/skill-detail-page";

// The English twin of src/app/skills/[slug]/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export function generateMetadata(props: SkillDetailPageProps) {
  return generateSkillDetailPageMetadata("en", props);
}

export default function Page(props: SkillDetailPageProps) {
  return <SkillDetailPage {...props} locale="en" />;
}
