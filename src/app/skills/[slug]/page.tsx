import Link from "next/link";
import { notFound } from "next/navigation";

import { ContentBody } from "@/components/content-body";
import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import {
  RelationshipGraph,
  type RelationshipGraphNode
} from "@/components/relationship-graph";
import { FollowableTagList } from "@/components/followable-tag-list";
import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import {
  findRelationBetween,
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getSkillBySlug,
  getTagsByIds
} from "@/lib/content";
import {
  getPreferredTechnologySummary,
  getPreferredTechnologyTitle,
  getRelationTypeLabel
} from "@/lib/technology-localization";
import type {
  DifficultyLevel,
  HeatLevel,
  KnowledgeCategory,
  KnowledgeItem,
  LearningCost,
  SkillItem,
  SkillType,
  TechnologyItem
} from "@/types/content";

interface SkillDetailPageProps {
  params: Promise<{ slug: string }>;
}

const skillTypeLabels: Record<SkillType, string> = {
  engineering: "工程落地",
  analysis: "评估与分析",
  product: "产品判断",
  operations: "运维与落地",
  communication: "团队沟通"
};

const heatLabels: Record<HeatLevel, string> = {
  hot: "当前热门",
  active: "活跃",
  emerging: "新兴"
};

const learningCostLabels: Record<LearningCost, string> = {
  low: "学习成本低",
  medium: "学习成本中等",
  high: "学习成本高"
};

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

export function generateStaticParams() {
  return getAllSkills().map((item) => ({ slug: item.slug }));
}

function getRelatedTechnologies(
  skill: SkillItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    skill.relatedTechnologyIds.includes(technology.id)
  );
}

function getRelatedKnowledge(
  skill: SkillItem,
  knowledgeItems: KnowledgeItem[]
): KnowledgeItem[] {
  return knowledgeItems.filter((knowledge) =>
    skill.relatedKnowledgeIds.includes(knowledge.id)
  );
}

function getSkillSignalExplanation(skill: SkillItem): string {
  switch (skill.skillType) {
    case "engineering":
      return "用这项技能判断信号能否成为可维护的产品或工程能力。";
    case "analysis":
      return "用这项技能检视证据、失败模式，以及信号是否值得真正测试。";
    case "product":
      return "用这项技能决定信号该成为产品押注、小型实验，还是观察项。";
    case "operations":
      return "用这项技能在采用前理解上线、可观测性和可靠性方面的影响。";
    case "communication":
      return "用这项技能把信号解释得足够清楚，以支撑跨职能决策。";
    default:
      return "用这项技能在更多背景下解读信号，少一些猜测。";
  }
}

function getSkillUseSteps(skill: SkillItem): string[] {
  return [
    `先从「${skillTypeLabels[skill.skillType]}」的视角进入，读一遍简短说明。`,
    "打开一条相关技术信号，找出它带来的具体变化。",
    "用背景知识链接补齐那些被默认却未必解释清楚的概念。",
    "判断这个信号是值得现在测试、持续跟踪，还是仅作了解。"
  ];
}

export default async function SkillDetailPage({
  params
}: SkillDetailPageProps) {
  const { slug } = await params;
  const skill = getSkillBySlug(slug);

  if (!skill) {
    notFound();
  }

  const technologies = getAllTechnologies();
  const knowledgeItems = getAllKnowledge();
  const tags = getTagsByIds(skill.tags);
  const relatedTechnologies = getRelatedTechnologies(skill, technologies);
  const relatedKnowledge = getRelatedKnowledge(skill, knowledgeItems);
  const technologyRelations = relatedTechnologies.map((technology) =>
    findRelationBetween(skill.id, "skill", technology.id, "technology")
  );
  const knowledgeRelations = relatedKnowledge.map((knowledge) =>
    findRelationBetween(skill.id, "skill", knowledge.id, "knowledge")
  );
  const graphNodes: RelationshipGraphNode[] = [
    ...relatedTechnologies.map((technology, index) => ({
      title: getPreferredTechnologyTitle(technology),
      href: `/technologies/${technology.slug}`,
      kind: "technology" as const,
      relationLabel: getRelationTypeLabel(
        technologyRelations[index].relationType,
        "zh"
      ),
      note: technologyRelations[index].note
    })),
    ...relatedKnowledge.map((knowledge, index) => ({
      title: knowledge.title,
      href: `/knowledge/${knowledge.slug}`,
      kind: "knowledge" as const,
      relationLabel: getRelationTypeLabel(
        knowledgeRelations[index].relationType,
        "zh"
      ),
      note: knowledgeRelations[index].note
    }))
  ];

  return (
    <UserPageShell
      title={skill.title}
      description={skill.summary}
      sectionLabel="理解技能"
      showHeader={false}
      className="skill-detail-page dossier"
    >
      <div className="skill-detail-layout">
        <section className="skill-detail-hero">
          <p className="skill-detail-kicker">
            {skillTypeLabels[skill.skillType]}
          </p>
          <h1>{skill.title}</h1>
          <p>{skill.summary}</p>
          <div className="skill-detail-hero__meta">
            <DossierStampTag>{heatLabels[skill.heatLevel]}</DossierStampTag>
            <DossierStampTag className="dossier-stamp-tag--muted">
              {learningCostLabels[skill.learningCost]}
            </DossierStampTag>
          </div>
          {tags.length > 0 ? <TagList tags={tags} limit={4} /> : null}
        </section>

        <div className="skill-detail-layout__body">
          <main className="skill-detail-main">
            {skill.content ? (
              <section className="skill-detail-section skill-detail-section--lead">
                <h2>这项技能能帮你做什么</h2>
                <ContentBody body={skill.content} />
              </section>
            ) : null}

            <section className="skill-detail-section">
              <h2>解读 AI 信号，为什么需要这项技能</h2>
              <p>{getSkillSignalExplanation(skill)}</p>
            </section>

            <RelationshipGraph
              centerTitle={skill.title}
              nodes={graphNodes}
              sectionClassName="skill-detail-section"
              hint="这项技能相邻的技术信号与背景概念，点击节点可继续探索。"
            />

            {relatedTechnologies.length > 0 ? (
              <section className="skill-detail-section">
                <div className="skill-detail-section__header">
                  <div>
                    <p>用已发布信号练习</p>
                    <h2>这项技能有助于评估的技术信号</h2>
                  </div>
                </div>
                <div className="skill-detail-related-list">
                  {relatedTechnologies.map((technology, index) => {
                    const technologyTags = getTagsByIds(technology.tags);

                    return (
                      <DossierCard
                        className="skill-detail-related-card"
                        key={technology.id}
                      >
                        <div>
                          <div className="skill-detail-related-card__toprow">
                            <p className="skill-detail-related-card__meta">
                              {technology.sourceName} · {technology.publishDate}
                            </p>
                            <DossierStampTag>
                              {getRelationTypeLabel(
                                technologyRelations[index].relationType,
                                "zh"
                              )}
                            </DossierStampTag>
                          </div>
                          <h3>
                            <Link href={`/technologies/${technology.slug}`}>
                              {getPreferredTechnologyTitle(technology)}
                            </Link>
                          </h3>
                          <p>{getPreferredTechnologySummary(technology)}</p>
                          {technology.whyItMatters ? (
                            <DossierCatalogNote label="为什么重要">
                              {technology.whyItMatters}
                            </DossierCatalogNote>
                          ) : null}
                          {technologyTags.length > 0 ? (
                            <TagList tags={technologyTags} limit={2} />
                          ) : null}
                        </div>
                        <Link
                          className="skill-detail-related-card__link"
                          href={`/technologies/${technology.slug}`}
                        >
                          查看相关信号
                        </Link>
                      </DossierCard>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {relatedKnowledge.length > 0 ? (
              <section className="skill-detail-section">
                <div className="skill-detail-section__header">
                  <div>
                    <p>背景概念</p>
                    <h2>与这项技能搭配的知识</h2>
                  </div>
                </div>
                <div className="skill-detail-related-list">
                  {relatedKnowledge.map((knowledge, index) => {
                    const knowledgeTags = getTagsByIds(knowledge.tags);

                    return (
                      <DossierCard
                        className="skill-detail-related-card skill-detail-related-card--knowledge"
                        key={knowledge.id}
                      >
                        <div>
                          <div className="skill-detail-related-card__toprow">
                            <p className="skill-detail-related-card__meta">
                              {categoryLabels[knowledge.category]} ·{" "}
                              {difficultyLabels[knowledge.difficulty]}
                            </p>
                            <DossierStampTag>
                              {getRelationTypeLabel(
                                knowledgeRelations[index].relationType,
                                "zh"
                              )}
                            </DossierStampTag>
                          </div>
                          <h3>
                            <Link href={`/knowledge/${knowledge.slug}`}>
                              {knowledge.title}
                            </Link>
                          </h3>
                          <p>{knowledge.summary}</p>
                          <DossierCatalogNote>
                            {knowledgeRelations[index].note ??
                              "理解这个概念，能帮你在解读新技术信号时更好地运用这项技能。"}
                          </DossierCatalogNote>
                          {knowledgeTags.length > 0 ? (
                            <TagList tags={knowledgeTags} limit={2} />
                          ) : null}
                        </div>
                        <Link
                          className="skill-detail-related-card__link"
                          href={`/knowledge/${knowledge.slug}`}
                        >
                          查看概念
                        </Link>
                      </DossierCard>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <section className="skill-detail-section">
              <h2>如何使用这项技能</h2>
              <ol className="skill-detail-steps">
                {getSkillUseSteps(skill).map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          </main>

          <aside className="skill-detail-aside" aria-label="技能概览">
            <section className="skill-detail-aside-card">
              <p className="skill-detail-kicker">技能档案</p>
              <dl className="skill-detail-profile">
                <div>
                  <dt>类别</dt>
                  <dd>{skillTypeLabels[skill.skillType]}</dd>
                </div>
                <div>
                  <dt>当前热度</dt>
                  <dd>{heatLabels[skill.heatLevel]}</dd>
                </div>
                <div>
                  <dt>学习成本</dt>
                  <dd>{learningCostLabels[skill.learningCost]}</dd>
                </div>
                <div>
                  <dt>技术信号</dt>
                  <dd>{relatedTechnologies.length}</dd>
                </div>
                <div>
                  <dt>背景概念</dt>
                  <dd>{relatedKnowledge.length}</dd>
                </div>
              </dl>
            </section>

            {tags.length > 0 ? (
              <section className="skill-detail-aside-card">
                <p className="skill-detail-kicker">主题</p>
                <FollowableTagList tags={tags} />
              </section>
            ) : null}

            <section className="skill-detail-aside-card">
              <p className="skill-detail-kicker">阅读路径</p>
              <p>先读技能说明，打开一条相关信号，再用关联概念补齐背景。</p>
            </section>
          </aside>
        </div>
      </div>
    </UserPageShell>
  );
}
