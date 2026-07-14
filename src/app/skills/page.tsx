import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { RelationDensity } from "@/components/relation-density";
import { TagList } from "@/components/tag-list";
import { UserPageShell } from "@/components/user-page-shell";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getTagsByIds
} from "@/lib/content";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type {
  HeatLevel,
  KnowledgeItem,
  LearningCost,
  SkillItem,
  SkillType,
  TechnologyItem
} from "@/types/content";

const cardTilts = ["a", "b", "c"] as const;

const skillTypeSections: Array<{
  id: SkillType;
  title: string;
  description: string;
  focus: string;
}> = [
  {
    id: "engineering",
    title: "工程落地",
    description: "在真实产品中构建、集成并运行 AI 系统。",
    focus: "当某个信号可能改变团队的构建或交付方式时，使用这些技能。"
  },
  {
    id: "analysis",
    title: "评估与分析",
    description: "判断一个信号是否有用、有风险，或是否可以测试。",
    focus: "用这些技能把持久的信号与一时的噪声区分开。"
  },
  {
    id: "product",
    title: "产品判断",
    description: "把技术变化转化为有明确范围的产品决策。",
    focus: "在把某项技术纳入路线图之前，使用这些技能。"
  },
  {
    id: "operations",
    title: "运维与落地",
    description: "让 AI 系统保持可观测、可靠、可安全运行。",
    focus: "当信号影响上线、可靠性或支持时，使用这些技能。"
  },
  {
    id: "communication",
    title: "团队沟通",
    description: "解释权衡取舍，并在团队间协调落地。",
    focus: "用这些技能帮助非专业人员理解技术变化。"
  }
];

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

function getSkillOutcome(skill: SkillItem): string {
  switch (skill.skillType) {
    case "engineering":
      return "帮助你判断一项新的 AI 能力在构建、集成和维护上是否切实可行。";
    case "analysis":
      return "帮助你评估证据、失败模式，以及信号是否已经可以测试。";
    case "product":
      return "帮助你把技术变化转化为范围明确的产品决策。";
    case "operations":
      return "帮助你判断上线、监控、可靠性和运维风险。";
    case "communication":
      return "帮助你解释变化，并在团队间协调落地。";
    default:
      return "帮助你在更多背景下解读技术信号，少一些猜测。";
  }
}

export default function SkillsPage() {
  const skills = getAllSkills();
  const technologies = getAllTechnologies();
  const knowledgeItems = getAllKnowledge();

  const hotSkills = skills.filter((skill) => skill.heatLevel === "hot").length;
  const relatedTechnologyCount = new Set(
    skills.flatMap((skill) => skill.relatedTechnologyIds)
  ).size;
  const relatedKnowledgeCount = new Set(
    skills.flatMap((skill) => skill.relatedKnowledgeIds)
  ).size;

  const groupedSkills = skillTypeSections
    .map((section) => ({
      ...section,
      items: skills.filter((skill) => skill.skillType === section.id)
    }))
    .filter((section) => section.items.length > 0);

  return (
    <UserPageShell
      title="理解 AI 信号的技能"
      description="用这些实用技能判断一个新的 AI 技术信号是否值得测试、跟踪，或向团队解释。"
      sectionLabel="理解技能"
      className="skills-library-page dossier"
    >
      {skills.length === 0 ? (
        <section className="skills-library-empty">
          <p className="skills-library-empty__eyebrow">技能库</p>
          <h2>暂无技能。</h2>
          <p>当已发布技能与用户端技术信号建立关联后，会在这里展示。</p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div className="skills-library-intro__copy">
              <p className="skills-library-kicker">如何使用这个技能库</p>
              <h2>技能把快速变化的技术信号连接到可落地的评估。</h2>
              <p>
                先从与你角色匹配的技能开始，再打开关联的技术信号和背景概念，
                理解这一变化在哪里重要。
              </p>
            </div>
            <dl className="skills-library-stats" aria-label="技能概览">
              <div>
                <dt>{skills.length}</dt>
                <dd>已收录技能</dd>
              </div>
              <div>
                <dt>{hotSkills}</dt>
                <dd>当前热门</dd>
              </div>
              <div>
                <dt>{relatedTechnologyCount}</dt>
                <dd>关联已发布信号</dd>
              </div>
              <div>
                <dt>{relatedKnowledgeCount}</dt>
                <dd>关联背景概念</dd>
              </div>
            </dl>
          </section>

          <section className="skills-library-guide" aria-label="阅读路径">
            <article>
              <h3>选一项技能</h3>
              <p>选择你判断技术信号时所需的能力。</p>
            </article>
            <article>
              <h3>打开一个信号</h3>
              <p>把关联的已发布信号当作具体示例。</p>
            </article>
            <article>
              <h3>补齐背景</h3>
              <p>当信号依赖更早的概念时，使用知识链接。</p>
            </article>
          </section>

          <div className="skills-library-groups">
            {groupedSkills.map((section) => (
              <section className="skills-library-section" key={section.id}>
                <div className="skills-library-section__header">
                  <div>
                    <p>技能方向</p>
                    <h2>{section.title}</h2>
                  </div>
                  <span>{section.focus}</span>
                </div>

                <div className="skills-library-card-grid">
                  {section.items.map((skill, index) => {
                    const relatedTechnologies = getRelatedTechnologies(
                      skill,
                      technologies
                    );
                    const relatedKnowledge = getRelatedKnowledge(
                      skill,
                      knowledgeItems
                    );
                    const tags = getTagsByIds(skill.tags);

                    return (
                      <DossierCard
                        tilt={cardTilts[index % cardTilts.length]}
                        className="skill-library-card"
                        key={skill.id}
                      >
                        <div className="dossier-technology-card__chips">
                          <DossierStampTag>
                            {heatLabels[skill.heatLevel]}
                          </DossierStampTag>
                          <DossierStampTag className="dossier-stamp-tag--muted">
                            {learningCostLabels[skill.learningCost]}
                          </DossierStampTag>
                        </div>
                        <h3>
                          <Link href={`/skills/${skill.slug}`}>
                            {skill.title}
                          </Link>
                        </h3>
                        <p className="skill-library-card__summary">
                          {skill.summary}
                        </p>
                        <DossierCatalogNote label="帮助你判断">
                          {getSkillOutcome(skill)}
                        </DossierCatalogNote>
                        <RelationDensity
                          items={[
                            { n: relatedTechnologies.length, label: "技术" },
                            { n: relatedKnowledge.length, label: "背景知识" }
                          ]}
                        />
                        {relatedTechnologies.length > 0 ? (
                          <div className="skill-library-card__signals">
                            <span>用这些来练习</span>
                            {relatedTechnologies
                              .slice(0, 2)
                              .map((technology) => (
                                <Link
                                  href={`/technologies/${technology.slug}`}
                                  key={technology.id}
                                >
                                  {getPreferredTechnologyTitle(technology)}
                                </Link>
                              ))}
                          </div>
                        ) : null}
                        {tags.length > 0 ? (
                          <TagList tags={tags} limit={3} />
                        ) : null}
                        <Link
                          className="skill-library-card__link"
                          href={`/skills/${skill.slug}`}
                        >
                          查看技能
                        </Link>
                      </DossierCard>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </UserPageShell>
  );
}
