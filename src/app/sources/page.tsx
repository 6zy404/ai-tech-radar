import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierCategoryChips } from "@/components/dossier-category-chips";
import { RelationDensity } from "@/components/relation-density";
import { UserPageShell } from "@/components/user-page-shell";
import { getAllTechnologies } from "@/lib/content";
import { buildPageMetadata, signalFeed } from "@/lib/site-metadata";
import {
  buildSourceDirectory,
  getSourceDirectoryAnchor,
  groupSourceDirectoryByPublisherType
} from "@/lib/source-directory";

// Reads runtime content through @/lib/content, so it must never be
// prerendered: a build-time copy freezes whatever the workspace had
// published when the build ran. See CHANGELOG - "Five public pages would
// have shipped frozen at build time".
export const dynamic = "force-dynamic";

const pageTitle = "信源一览";
const pageDescription =
  "已发布的技术信号来自哪些组织、经由哪些信源，按发布方汇总。";

export const metadata = buildPageMetadata({
  title: pageTitle,
  description: pageDescription,
  path: "/sources",
  // Everything on this page is derived from the published signals, so the
  // all-signals feed is the one to subscribe to from here.
  feeds: [signalFeed]
});

function sectionId(publisherType: string): string {
  return `sources-section-${publisherType}`;
}

// The /skills, /knowledge and /topics list skeleton — header label, one-line
// lede, a caption row of counts, sections of two-column cards — through their
// classes rather than a copy. Built only from published signals' public
// fields; see src/lib/source-directory.ts for what it must never read.
export default function SourcesPage() {
  const { entries, totals } = buildSourceDirectory(getAllTechnologies());
  const sections = groupSourceDirectoryByPublisherType(entries);

  return (
    <UserPageShell
      title={pageTitle}
      description={pageDescription}
      sectionLabel="信源"
      className="skills-library-page sources-page dossier"
    >
      {entries.length === 0 ? (
        <section className="skills-library-empty">
          <p className="eyebrow user-eyebrow">暂无信源</p>
          <h2>还没有已发布的技术信号。</h2>
          <p>信号发布后，会在这里按发布方汇总。</p>
        </section>
      ) : (
        <>
          <section className="skills-library-intro">
            <div className="skills-library-intro__copy">
              {/* One line on purpose: JSX joins wrapped text lines with a
                  space, which lands in the middle of a Chinese sentence. */}
              <p>
                发布方是公告背后的组织，信源是它经由的那个订阅源；同一个发布方可能从几个信源进来。
              </p>
            </div>
            <dl className="skills-library-stats" aria-label="信源概览">
              <div>
                <dt>{totals.publishers}</dt>
                <dd>个发布方</dd>
              </div>
              <div>
                <dt>{totals.signals}</dt>
                <dd>条已发布信号</dd>
              </div>
              <div>
                <dt>{totals.sources}</dt>
                <dd>个信源</dd>
              </div>
            </dl>
            {/* Jump links, not a filter: the cards run to several screens,
                and these land on a section without hiding the rest. */}
            <DossierCategoryChips
              className="sources-jump"
              ariaLabel="跳到发布方类型"
              active=""
              options={sections.map((section) => ({
                value: section.publisherType,
                label: `${section.label} · ${section.entries.length}`,
                href: `#${sectionId(section.publisherType)}`
              }))}
            />
          </section>

          <div className="skills-library-groups">
            {sections.map((section) => (
              <section
                className="skills-library-section"
                key={section.publisherType}
                aria-labelledby={sectionId(section.publisherType)}
              >
                <div className="skills-library-section__header">
                  <div>
                    <p className="eyebrow user-eyebrow">发布方类型</p>
                    <h2 id={sectionId(section.publisherType)}>
                      {section.label}
                    </h2>
                  </div>
                  <p>
                    {section.entries.length} 个发布方 · {section.signalCount}{" "}
                    条信号
                  </p>
                </div>
                <div className="skills-library-card-grid">
                  {section.entries.map((entry) => (
                    <DossierCard
                      className="skill-library-card sources-card"
                      key={entry.publisherName}
                    >
                      <h3 id={getSourceDirectoryAnchor(entry.publisherName)}>
                        {entry.publisherName}
                      </h3>
                      <RelationDensity
                        label="收录"
                        items={[
                          { n: entry.signalCount, label: "信号" },
                          { n: entry.sourceNames.length, label: "信源" }
                        ]}
                      />
                      <div className="skill-library-card__signals sources-card__recent">
                        <span>
                          {entry.recent.length === 1
                            ? "最新一条"
                            : `最近 ${entry.recent.length} 条`}
                        </span>
                        <ol>
                          {entry.recent.map((item) => (
                            <li key={item.slug}>
                              <time dateTime={item.publishDate}>
                                {item.publishDate}
                              </time>
                              <Link href={`/technologies/${item.slug}`}>
                                {item.title}
                              </Link>
                            </li>
                          ))}
                        </ol>
                      </div>
                      <p className="sources-card__via">
                        <span>经由</span> {entry.sourceNames.join(" · ")}
                      </p>
                    </DossierCard>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </UserPageShell>
  );
}
