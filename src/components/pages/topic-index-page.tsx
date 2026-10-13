import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { RelationDensity } from "@/components/relation-density";
import { UserPageShell } from "@/components/user-page-shell";
import { buildPageMetadata } from "@/lib/site-metadata";
import { getTopicIndex } from "@/lib/topic-hub";

const pageTitle = "按话题浏览";
const pageDescription =
  "每个话题把同一主题下的已发布技术信号、技能和背景知识放在一起。";

export const topicIndexPageMetadata = buildPageMetadata({
  title: pageTitle,
  description: pageDescription,
  path: "/topics"
});

// The index shares the /skills and /knowledge list skeleton — header label,
// one-line lede, a caption row of counts, a two-column card grid — through
// their classes rather than a copy, so the three index pages stay one family.
export function TopicIndexPage() {
  const { topics, coverage } = getTopicIndex();

  return (
    <UserPageShell
      title={pageTitle}
      description={pageDescription}
      sectionLabel="话题"
      className="skills-library-page topic-index-page dossier"
    >
      {topics.length === 0 ? (
        <section className="skills-library-empty">
          <p className="eyebrow user-eyebrow">暂无话题</p>
          <h2>还没有带话题的已发布内容。</h2>
          <p>信号、技能或知识发布并标注话题后，会在这里按话题汇总。</p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div className="skills-library-intro__copy">
              {/* One line on purpose: JSX joins wrapped text lines with a
                  space, which lands in the middle of a Chinese sentence. */}
              <p>
                信号最多的话题排在前面；打开一个话题，能看到它下面的全部内容和图谱里的相邻条目。
              </p>
            </div>
            <dl className="skills-library-stats" aria-label="话题概览">
              <div>
                <dt>{topics.length}</dt>
                <dd>个话题</dd>
              </div>
              <div>
                <dt>{coverage.technologies}</dt>
                <dd>条已发布信号</dd>
              </div>
              <div>
                <dt>{coverage.skills}</dt>
                <dd>项技能</dd>
              </div>
              <div>
                <dt>{coverage.knowledge}</dt>
                <dd>条背景知识</dd>
              </div>
            </dl>
          </section>

          <div className="skills-library-groups">
            <div className="skills-library-card-grid">
              {topics.map((topic) => (
                <DossierCard
                  className="skill-library-card topic-index-card"
                  key={topic.id}
                >
                  <h3>
                    <Link href={`/topics/${topic.id}`}>{topic.name}</Link>
                  </h3>
                  <p className="skill-library-card__summary">
                    {topic.description}
                  </p>
                  <RelationDensity
                    label="收录"
                    items={[
                      { n: topic.technologyCount, label: "信号" },
                      { n: topic.skillCount, label: "技能" },
                      { n: topic.knowledgeCount, label: "知识" }
                    ]}
                  />
                  <Link
                    className="skill-library-card__link"
                    href={`/topics/${topic.id}`}
                  >
                    查看专题
                  </Link>
                </DossierCard>
              ))}
            </div>
          </div>
        </>
      )}
    </UserPageShell>
  );
}
