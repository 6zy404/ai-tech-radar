import type { ComponentProps } from "react";

import {
  getSkillsPageMetadata,
  SkillsPage
} from "@/components/pages/skills-index-page";

// The English twin of src/app/skills/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export const metadata = getSkillsPageMetadata("en");

export default function Page(
  props: Omit<ComponentProps<typeof SkillsPage>, "locale">
) {
  return <SkillsPage {...props} locale="en" />;
}
