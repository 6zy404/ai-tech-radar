import type { ComponentProps } from "react";

import {
  getKnowledgePageMetadata,
  KnowledgePage
} from "@/components/pages/knowledge-index-page";

// The English twin of src/app/knowledge/page.tsx; see it for the render mode.
export const dynamic = "force-dynamic";

export const metadata = getKnowledgePageMetadata("en");

export default function Page(
  props: Omit<ComponentProps<typeof KnowledgePage>, "locale">
) {
  return <KnowledgePage {...props} locale="en" />;
}
