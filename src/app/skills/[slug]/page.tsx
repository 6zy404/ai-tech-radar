import {
  generateSkillDetailPageMetadata,
  SkillDetailPage
} from "@/components/pages/skill-detail-page";

// Reads runtime content through @/lib/content, so it must never be
// prerendered: a build-time copy freezes whatever the workspace had
// published when the build ran and never regenerates
// (initialRevalidateSeconds is false). See CHANGELOG - "Five public pages
// would have shipped frozen at build time".
export const dynamic = "force-dynamic";

export const generateMetadata = generateSkillDetailPageMetadata;

export default SkillDetailPage;
