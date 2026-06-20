import { notFound } from "next/navigation";

import { RelationList } from "@/components/relation-list";
import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import {
  buildRelationItems,
  getAllKnowledge,
  getKnowledgeBySlug,
  getTagsByIds
} from "@/lib/content";
import type {
  DifficultyLevel,
  KnowledgeCategory,
  RelationListItem
} from "@/types/content";

interface KnowledgeDetailPageProps {
  params: Promise<{ slug: string }>;
}

const categoryLabels: Record<KnowledgeCategory, string> = {
  "machine-learning": "机器学习",
  "software-architecture": "软件架构",
  data: "数据",
  "product-thinking": "产品思维",
  operations: "运维"
};

const difficultyLabels: Record<DifficultyLevel, string> = {
  foundation: "基础",
  intermediate: "进阶",
  advanced: "高级"
};

function formatRelationType(
  relationType: RelationListItem["relationType"]
): string {
  return relationType.split("-").join(" ");
}

function getConceptMatter(category: KnowledgeCategory): string {
  const categoryCopy: Record<KnowledgeCategory, string> = {
    "machine-learning":
      "在判断新的 AI 信号之前，这个概念帮助读者区分模型行为、评估局限和实际约束。",
    "software-architecture":
      "这个概念帮助读者看清新工具或平台变化背后的接口边界与系统权衡。",
    data: "这个概念帮助读者理解检索、时效、可信度和数据流动如何塑造 AI 产品质量。",
    "product-thinking":
      "这个概念帮助读者把技术变化转化为落地选择、范围决策和产品风险。",
    operations:
      "这个概念帮助读者理解当 AI 系统触达真实用户时的评审闭环、故障可见性和上线纪律。"
  };

  return categoryCopy[category];
}

function getLearningSteps(difficulty: DifficultyLevel): string[] {
  const sharedSteps = [
    "在打开相关技术信号之前，先读一遍概念摘要。",
    "打开一条关联信号，找出概念在产品或工程变化中出现的位置。",
    "把概念与一项相关技能搭配，决定接下来评估什么。"
  ];

  if (difficulty === "advanced") {
    return [
      ...sharedSteps,
      "用这个概念比较更长期的架构、数据或战略权衡。"
    ];
  }

  if (difficulty === "intermediate") {
    return [
      ...sharedSteps,
      "用这个概念比较实现选择及其运维后果。"
    ];
  }

  return sharedSteps;
}

export function generateStaticParams() {
  return getAllKnowledge().map((item) => ({ slug: item.slug }));
}

export default async function KnowledgeDetailPage({
  params
}: KnowledgeDetailPageProps) {
  const { slug } = await params;
  const knowledge = getKnowledgeBySlug(slug);

  if (!knowledge) {
    notFound();
  }

  const relatedTechnologies = buildRelationItems({
    fromId: knowledge.id,
    fromType: "knowledge",
    targetType: "technology",
    targetIds: knowledge.relatedTechnologyIds,
    defaultNote: "这条已发布信号依赖于该背景概念。"
  });

  const relatedSkills = buildRelationItems({
    fromId: knowledge.id,
    fromType: "knowledge",
    targetType: "skill",
    targetIds: knowledge.relatedSkillIds,
    defaultNote: "有了这个概念，这项技能会更容易练习。"
  });

  const tags = getTagsByIds(knowledge.tags);
  const learningSteps = getLearningSteps(knowledge.difficulty);

  return (
    <UserPageShell
      title={knowledge.title}
      description={knowledge.summary}
      sectionLabel="背景知识"
      showHeader={false}
      className="skill-detail-page knowledge-detail-page"
    >
      <div className="skill-detail-layout">
        <main className="skill-detail-main">
          <section className="skill-detail-hero">
            <p className="eyebrow user-eyebrow">
              {categoryLabels[knowledge.category]}
            </p>
            <h1>{knowledge.title}</h1>
            <p>{knowledge.summary}</p>
            {tags.length > 0 ? <TagList tags={tags} limit={4} /> : null}
          </section>

          {knowledge.content ? (
            <section className="skill-detail-section skill-detail-section--lead">
              <h2>这个概念是什么意思</h2>
              <p>{knowledge.content}</p>
            </section>
          ) : null}

          <section className="skill-detail-section">
            <h2>这个概念为何重要</h2>
            <p>{getConceptMatter(knowledge.category)}</p>
          </section>

          <RelationList
            className="skill-detail-section"
            title="由这个概念解释的技术信号"
            description="当这个概念清晰之后，这些已发布信号会更容易理解。"
            emptyText="暂无已发布技术信号引用这个概念。"
            items={relatedTechnologies}
            linkLabel="查看相关信号"
            formatRelationType={formatRelationType}
          />

          <RelationList
            className="skill-detail-section"
            title="使用这个概念的技能"
            description="这些实用技能依赖于此处描述的背景模型。"
            emptyText="暂无技能关联到这个概念。"
            items={relatedSkills}
            linkLabel="查看技能"
            formatRelationType={formatRelationType}
          />

          <section className="skill-detail-section">
            <h2>如何继续学习</h2>
            <ol className="skill-detail-steps">
              {learningSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </main>

        <aside className="skill-detail-aside" aria-label="知识概览">
          <section className="skill-detail-aside-card">
            <p className="eyebrow user-eyebrow">知识档案</p>
            <h2>{knowledge.title}</h2>
            <dl className="skill-detail-profile">
              <div>
                <dt>类别</dt>
                <dd>{categoryLabels[knowledge.category]}</dd>
              </div>
              <div>
                <dt>难度</dt>
                <dd>{difficultyLabels[knowledge.difficulty]}</dd>
              </div>
              <div>
                <dt>技术关联</dt>
                <dd>{relatedTechnologies.length}</dd>
              </div>
              <div>
                <dt>技能关联</dt>
                <dd>{relatedSkills.length}</dd>
              </div>
            </dl>
          </section>

          {tags.length > 0 ? (
            <section className="skill-detail-aside-card">
              <p className="eyebrow user-eyebrow">主题</p>
              <TagList tags={tags} limit={4} />
            </section>
          ) : null}

          <section className="skill-detail-aside-card">
            <p className="eyebrow user-eyebrow">阅读路径</p>
            <h2>如何使用本页</h2>
            <p>
              先从概念开始，打开一条相关信号，再用关联技能决定接下来评估什么。
            </p>
          </section>
        </aside>
      </div>
    </UserPageShell>
  );
}
