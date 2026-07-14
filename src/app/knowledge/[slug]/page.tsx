import Link from "next/link";
import { notFound } from "next/navigation";

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
  getKnowledgeBySlug,
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
  SkillItem,
  SkillType,
  TechnologyItem
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

function getRelatedTechnologies(
  knowledge: KnowledgeItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    knowledge.relatedTechnologyIds.includes(technology.id)
  );
}

function getRelatedSkills(
  knowledge: KnowledgeItem,
  skills: SkillItem[]
): SkillItem[] {
  return skills.filter((skill) => knowledge.relatedSkillIds.includes(skill.id));
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
    return [...sharedSteps, "用这个概念比较更长期的架构、数据或战略权衡。"];
  }

  if (difficulty === "intermediate") {
    return [...sharedSteps, "用这个概念比较实现选择及其运维后果。"];
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

  const technologies = getAllTechnologies();
  const skills = getAllSkills();
  const tags = getTagsByIds(knowledge.tags);
  const relatedTechnologies = getRelatedTechnologies(knowledge, technologies);
  const relatedSkills = getRelatedSkills(knowledge, skills);
  const learningSteps = getLearningSteps(knowledge.difficulty);
  const technologyRelations = relatedTechnologies.map((technology) =>
    findRelationBetween(knowledge.id, "knowledge", technology.id, "technology")
  );
  const skillRelations = relatedSkills.map((skill) =>
    findRelationBetween(knowledge.id, "knowledge", skill.id, "skill")
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
    ...relatedSkills.map((skill, index) => ({
      title: skill.title,
      href: `/skills/${skill.slug}`,
      kind: "skill" as const,
      relationLabel: getRelationTypeLabel(
        skillRelations[index].relationType,
        "zh"
      ),
      note: skillRelations[index].note
    }))
  ];

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
            <p className="skill-detail-kicker">
              {categoryLabels[knowledge.category]}
            </p>
            <h1>{knowledge.title}</h1>
            <p>{knowledge.summary}</p>
            <div className="skill-detail-hero__meta">
              <span>{categoryLabels[knowledge.category]}</span>
              <span>{difficultyLabels[knowledge.difficulty]}</span>
            </div>
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

          <RelationshipGraph
            centerTitle={knowledge.title}
            nodes={graphNodes}
            sectionClassName="skill-detail-section"
            hint="这个概念相邻的技术信号与相关技能，点击节点可继续探索。"
          />

          {relatedTechnologies.length > 0 ? (
            <section className="skill-detail-section">
              <div className="skill-detail-section__header">
                <div>
                  <p>可解释</p>
                  <h2>这个概念能解释的技术信号</h2>
                </div>
              </div>
              <div className="skill-detail-related-list">
                {relatedTechnologies.map((technology, index) => {
                  const technologyTags = getTagsByIds(technology.tags);

                  return (
                    <article
                      className="skill-detail-related-card"
                      key={technology.id}
                    >
                      <div>
                        <div className="skill-detail-related-card__toprow">
                          <p className="skill-detail-related-card__meta">
                            {technology.sourceName} · {technology.publishDate}
                          </p>
                          <span className="user-related-section__relation">
                            {getRelationTypeLabel(
                              technologyRelations[index].relationType,
                              "zh"
                            )}
                          </span>
                        </div>
                        <h3>
                          <Link href={`/technologies/${technology.slug}`}>
                            {getPreferredTechnologyTitle(technology)}
                          </Link>
                        </h3>
                        <p>{getPreferredTechnologySummary(technology)}</p>
                        {technology.whyItMatters ? (
                          <div className="skill-detail-related-card__note">
                            <span>这个概念在这里如何体现</span>
                            <p>{technology.whyItMatters}</p>
                          </div>
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
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

          {relatedSkills.length > 0 ? (
            <section className="skill-detail-section">
              <div className="skill-detail-section__header">
                <div>
                  <p>搭配技能</p>
                  <h2>使用这个概念的技能</h2>
                </div>
              </div>
              <div className="skill-detail-related-list">
                {relatedSkills.map((skill, index) => {
                  const skillTags = getTagsByIds(skill.tags);

                  return (
                    <article
                      className="skill-detail-related-card skill-detail-related-card--knowledge"
                      key={skill.id}
                    >
                      <div>
                        <div className="skill-detail-related-card__toprow">
                          <p className="skill-detail-related-card__meta">
                            {skillTypeLabels[skill.skillType]} ·{" "}
                            {heatLabels[skill.heatLevel]}
                          </p>
                          <span className="user-related-section__relation">
                            {getRelationTypeLabel(
                              skillRelations[index].relationType,
                              "zh"
                            )}
                          </span>
                        </div>
                        <h3>
                          <Link href={`/skills/${skill.slug}`}>
                            {skill.title}
                          </Link>
                        </h3>
                        <p>{skill.summary}</p>
                        <div className="skill-detail-related-card__note">
                          <span>附注</span>
                          <p>有了这个概念，这项技能会更容易练习和应用。</p>
                        </div>
                        {skillTags.length > 0 ? (
                          <TagList tags={skillTags} limit={2} />
                        ) : null}
                      </div>
                      <Link
                        className="skill-detail-related-card__link"
                        href={`/skills/${skill.slug}`}
                      >
                        查看技能
                      </Link>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : null}

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
            <p className="skill-detail-kicker">知识档案</p>
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
                <dt>技术信号</dt>
                <dd>{relatedTechnologies.length}</dd>
              </div>
              <div>
                <dt>关联技能</dt>
                <dd>{relatedSkills.length}</dd>
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
            <p>
              先从概念开始，打开一条相关信号，再用关联技能决定接下来评估什么。
            </p>
          </section>
        </aside>
      </div>
    </UserPageShell>
  );
}
