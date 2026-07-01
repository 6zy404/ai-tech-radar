import Link from "next/link";

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
  DifficultyLevel,
  KnowledgeCategory,
  KnowledgeItem,
  SkillItem,
  TechnologyItem
} from "@/types/content";

const difficultySections: Array<{
  id: DifficultyLevel;
  title: string;
  description: string;
}> = [
  {
    id: "foundation",
    title: "基础概念",
    description: "当技术信号涉及陌生术语或更早的技术思想时，从这里开始。"
  },
  {
    id: "intermediate",
    title: "进阶模式",
    description: "用这些概念比较不同方案、权衡取舍和实现路径。"
  },
  {
    id: "advanced",
    title: "高级背景",
    description: "当信号改变架构、数据或技术战略假设时，使用这些背景。"
  }
];

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

function getRelatedTechnologies(
  item: KnowledgeItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    item.relatedTechnologyIds.includes(technology.id)
  );
}

function getRelatedSkillCount(item: KnowledgeItem, skills: SkillItem[]): number {
  return skills.filter((skill) => item.relatedSkillIds.includes(skill.id))
    .length;
}

function getKnowledgeOutcome(item: KnowledgeItem): string {
  const categoryOutcomes: Record<KnowledgeCategory, string> = {
    "machine-learning": "帮助你判断模型行为、评估的局限，以及实际约束。",
    "software-architecture": "帮助你识别接口边界、系统权衡和集成风险。",
    data: "帮助你理解检索、时效、可信度和数据流方面的假设。",
    "product-thinking": "帮助你把技术变化转化为有范围的产品与落地决策。",
    operations: "帮助你思考评审闭环、可观测性和上线纪律。"
  };

  return categoryOutcomes[item.category];
}

export default function KnowledgePage() {
  const knowledgeItems = getAllKnowledge();
  const technologies = getAllTechnologies();
  const skills = getAllSkills();
  const foundationCount = knowledgeItems.filter(
    (item) => item.difficulty === "foundation"
  ).length;
  const relatedSkillCount = new Set(
    knowledgeItems.flatMap((item) => item.relatedSkillIds)
  ).size;
  const relatedTechnologyCount = new Set(
    knowledgeItems.flatMap((item) => item.relatedTechnologyIds)
  ).size;
  const groupedKnowledge = difficultySections
    .map((section) => ({
      ...section,
      items: knowledgeItems.filter((item) => item.difficulty === section.id)
    }))
    .filter((section) => section.items.length > 0);

  return (
    <UserPageShell
      title="解读 AI 信号的知识"
      description="帮助用户理解 AI 技术信号及其背景的概念。"
      sectionLabel="背景知识"
      className="skills-library-page knowledge-library-page"
    >
      {knowledgeItems.length === 0 ? (
        <section className="skills-library-empty">
          <p className="eyebrow user-eyebrow">暂无概念</p>
          <h2>暂无知识概念。</h2>
          <p>学习库填充后，已发布的背景概念会在这里展示。</p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div>
              <p className="eyebrow user-eyebrow">概念地图</p>
              <h2>知识把快速变化的信号转化为可理解的模式。</h2>
              <p>
                当技术信号引用了你需要复习的概念时，使用本页。每个概念都会说明
                它澄清了什么，以及哪些已发布信号依赖于它。
              </p>
            </div>
            <dl className="skills-library-stats" aria-label="知识概览">
              <div>
                <dt>{knowledgeItems.length}</dt>
                <dd>知识概念</dd>
              </div>
              <div>
                <dt>{foundationCount}</dt>
                <dd>基础级条目</dd>
              </div>
              <div>
                <dt>{relatedSkillCount}</dt>
                <dd>关联技能</dd>
              </div>
              <div>
                <dt>{relatedTechnologyCount}</dt>
                <dd>关联已发布信号</dd>
              </div>
            </dl>
          </section>

          <section className="skills-library-guide" aria-label="阅读路径">
            <article>
              <h3>从概念开始</h3>
              <p>打开信号前，先复习背景概念。</p>
            </article>
            <article>
              <h3>打开相关信号</h3>
              <p>看看这个概念出现在哪些已发布的 AI 变化中。</p>
            </article>
            <article>
              <h3>搭配技能</h3>
              <p>用关联技能评估或应用该概念。</p>
            </article>
          </section>

          <div className="skills-library-groups">
            {groupedKnowledge.map((section) => (
              <section key={section.id} className="skills-library-section">
                <div className="skills-library-section__header">
                  <div>
                    <p className="eyebrow user-eyebrow">
                      {difficultyLabels[section.id]}
                    </p>
                    <h2>{section.title}</h2>
                  </div>
                  <p>{section.description}</p>
                </div>
                <div className="skills-library-card-grid">
                  {section.items.map((item) => {
                    const relatedTechnologies = getRelatedTechnologies(
                      item,
                      technologies
                    );
                    const relatedTechnologyPreview = relatedTechnologies.slice(
                      0,
                      2
                    );
                    const relatedSkillTotal = getRelatedSkillCount(item, skills);

                    return (
                      <article
                        key={item.id}
                        className="skill-library-card knowledge-library-card"
                      >
                        <div className="skill-library-card__meta">
                          <span>{categoryLabels[item.category]}</span>
                          <span>{difficultyLabels[item.difficulty]}</span>
                        </div>
                        <h2>
                          <Link href={`/knowledge/${item.slug}`}>
                            {item.title}
                          </Link>
                        </h2>
                        <p>{item.summary}</p>
                        <div className="skill-library-card__outcome">
                          <span>帮助你理解</span>
                          <p>{getKnowledgeOutcome(item)}</p>
                        </div>
                        <RelationDensity
                          items={[
                            { n: relatedTechnologies.length, label: "技术" },
                            { n: relatedSkillTotal, label: "技能" }
                          ]}
                        />
                        {relatedTechnologyPreview.length > 0 ? (
                          <div className="skill-library-card__signals">
                            <span>解释如下信号</span>
                            <ul>
                              {relatedTechnologyPreview.map((technology) => (
                                <li key={technology.id}>
                                  <Link
                                    href={`/technologies/${technology.slug}`}
                                  >
                                    {getPreferredTechnologyTitle(technology)}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                        <TagList tags={getTagsByIds(item.tags)} limit={3} />
                        <Link
                          className="skill-library-card__link"
                          href={`/knowledge/${item.slug}`}
                        >
                          查看概念
                        </Link>
                      </article>
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
