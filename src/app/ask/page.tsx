import { AskRadar } from "@/components/ask-radar";
import { UserPageShell } from "@/components/user-page-shell";
import { buildAskExamples } from "@/lib/ask-examples";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTags,
  getAllTechnologies
} from "@/lib/content";
import { buildPageMetadata } from "@/lib/site-metadata";

// Answers are generated per request through POST /api/ask; the page itself
// holds no content, but every page declares its render mode (see
// validate:deployment).
export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "问雷达",
  description:
    "只根据本站已发布的技术信号、技能和知识回答，每句话标出出处。站里没有的内容，它会直说。",
  path: "/ask"
});

interface AskPageProps {
  searchParams: Promise<{ q?: string | string[] }>;
}

export default async function AskPage({ searchParams }: AskPageProps) {
  // Arriving from /search pre-fills the box but does not ask: a navigation
  // should never spend a model call on its own. A repeated `?q=` arrives as
  // an array (it answered 500 until 2026-10-14); the first one is used.
  const { q } = await searchParams;
  const rawQuestion = Array.isArray(q) ? q[0] : q;
  const initialQuestion =
    typeof rawQuestion === "string" ? rawQuestion.trim().slice(0, 200) : "";
  // Built by fixed rules from what is published now, so they change as the
  // site does and never name something it does not hold.
  const examples = buildAskExamples({
    technologies: getAllTechnologies(),
    knowledge: getAllKnowledge(),
    skills: getAllSkills(),
    tags: getAllTags()
  });

  return (
    <UserPageShell
      title="问雷达"
      description="只根据本站已发布的技术信号、技能和知识回答，每句话标出出处。站里没有的内容，它会直说。"
      sectionLabel="问雷达"
      className="ask-page dossier"
    >
      <AskRadar examples={examples} initialQuestion={initialQuestion} />
    </UserPageShell>
  );
}
