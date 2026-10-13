import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import {
  LibraryFilter,
  type LibraryFilterSection
} from "@/components/library-filter";
import { RelationDensity } from "@/components/relation-density";
import { TagList } from "@/components/tag-list";
import { UnbreakableTitle } from "@/components/unbreakable-title";
import { UserPageShell } from "@/components/user-page-shell";
import {
  difficultyLabels,
  knowledgeCategoryLabels
} from "@/lib/content-labels";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getTagsByIds
} from "@/lib/content";
import {
  buildLibraryFilterText,
  parseLibraryFilterQuery
} from "@/lib/library-filter";
import { getPreferredTechnologyTitle } from "@/lib/technology-localization";
import type {
  DifficultyLevel,
  KnowledgeCategory,
  KnowledgeItem,
  SkillItem,
  TechnologyItem
} from "@/types/content";
import { buildPageMetadata } from "@/lib/site-metadata";

export const knowledgePageMetadata = buildPageMetadata({
  title: "解读 AI 信号的知识",
  description: "帮助用户理解 AI 技术信号及其背景的概念。",
  path: "/knowledge"
});

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

function getRelatedTechnologies(
  item: KnowledgeItem,
  technologies: TechnologyItem[]
): TechnologyItem[] {
  return technologies.filter((technology) =>
    item.relatedTechnologyIds.includes(technology.id)
  );
}

function getRelatedSkillCount(
  item: KnowledgeItem,
  skills: SkillItem[]
): number {
  return skills.filter((skill) => item.relatedSkillIds.includes(skill.id))
    .length;
}

function getKnowledgeOutcome(item: KnowledgeItem): string {
  // The card renders these under a 帮助你理解 label, so they read as its
  // object. They each used to open with 帮助你… of their own, which printed
  // 帮助你理解帮助你理解… on the two that matched.
  const categoryOutcomes: Record<KnowledgeCategory, string> = {
    "machine-learning": "模型行为、评估的局限，以及实际约束。",
    "software-architecture": "接口边界、系统权衡和集成风险。",
    data: "检索、时效、可信度和数据流方面的假设。",
    "product-thinking": "技术变化如何转化为有范围的产品与落地决策。",
    operations: "评审闭环、可观测性和上线纪律。"
  };

  return categoryOutcomes[item.category];
}

export async function KnowledgePage({
  searchParams
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const initialQuery = parseLibraryFilterQuery(q);
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

  const filterSections: LibraryFilterSection[] = groupedKnowledge.map(
    (section) => ({
      id: section.id,
      header: (
        <div className="skills-library-section__header">
          <div>
            <p className="eyebrow user-eyebrow">
              {difficultyLabels[section.id]}
            </p>
            <h2>{section.title}</h2>
          </div>
          <p>{section.description}</p>
        </div>
      ),
      items: section.items.map((item) => {
        const relatedTechnologies = getRelatedTechnologies(item, technologies);
        const relatedTechnologyPreview = relatedTechnologies.slice(0, 2);
        const relatedSkillTotal = getRelatedSkillCount(item, skills);
        const tags = getTagsByIds(item.tags);

        return {
          id: item.id,
          // What the reader sees for this concept: its card, including the
          // category stamp.
          text: buildLibraryFilterText([
            item.title,
            item.summary,
            ...tags.map((tag) => tag.name),
            knowledgeCategoryLabels[item.category]
          ]),
          card: (
            <DossierCard className="skill-library-card knowledge-library-card">
              <div className="dossier-technology-card__chips">
                <DossierStampTag>
                  {knowledgeCategoryLabels[item.category]}
                </DossierStampTag>
                <DossierStampTag className="dossier-stamp-tag--muted">
                  {difficultyLabels[item.difficulty]}
                </DossierStampTag>
              </div>
              <h2>
                <Link href={`/knowledge/${item.slug}`}>
                  <UnbreakableTitle text={item.title} />
                </Link>
              </h2>
              <p>{item.summary}</p>
              <DossierCatalogNote label="帮助你理解">
                {getKnowledgeOutcome(item)}
              </DossierCatalogNote>
              <RelationDensity
                items={[
                  { n: relatedTechnologies.length, label: "技术" },
                  { n: relatedSkillTotal, label: "技能" }
                ]}
              />
              {relatedTechnologyPreview.length > 0 ? (
                <div className="skill-library-card__signals">
                  <span>可解释信号</span>
                  <ul>
                    {relatedTechnologyPreview.map((technology) => (
                      <li key={technology.id}>
                        <Link href={`/technologies/${technology.slug}`}>
                          {getPreferredTechnologyTitle(technology)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <TagList tags={tags} limit={3} />
              <Link
                className="skill-library-card__link"
                href={`/knowledge/${item.slug}`}
              >
                查看概念
              </Link>
            </DossierCard>
          )
        };
      })
    })
  );

  return (
    <UserPageShell
      title="解读 AI 信号的知识"
      description="帮助用户理解 AI 技术信号及其背景的概念。"
      sectionLabel="背景知识"
      className="skills-library-page knowledge-library-page dossier"
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
              {/* One line on purpose: JSX joins wrapped text lines with a
                  space, which lands in the middle of a Chinese sentence. */}
              <p>
                当技术信号引用了你需要复习的概念时，使用本页。每个概念都会说明它澄清了什么，以及哪些已发布信号依赖于它。
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

          <LibraryFilter
            kind="knowledge"
            label="筛选概念"
            placeholder="按标题、摘要、标签或类别筛选"
            countUnit="个概念"
            noun="概念"
            initialQuery={initialQuery}
            sections={filterSections}
          />
        </>
      )}
    </UserPageShell>
  );
}
