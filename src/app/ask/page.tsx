import { AskRadar } from "@/components/ask-radar";
import { UserPageShell } from "@/components/user-page-shell";

// Answers are generated per request through POST /api/ask; the page itself
// holds no content, but every page declares its render mode (see
// validate:deployment).
export const dynamic = "force-dynamic";

const examples = [
  "本地跑大模型要注意什么？",
  "智能体越权是怎么发生的？",
  "怎么判断一个基准分数靠不靠谱？"
];

interface AskPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AskPage({ searchParams }: AskPageProps) {
  // Arriving from /search pre-fills the box but does not ask: a navigation
  // should never spend a model call on its own.
  const { q } = await searchParams;
  const initialQuestion = q?.trim().slice(0, 200) ?? "";

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
