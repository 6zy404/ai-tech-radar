import { ContentCard } from "@/components/content-card";
import { PageShell } from "@/components/page-shell";
import { TagBadge } from "@/components/tag-badge";
import {
  getAllKnowledge,
  getAllSkills,
  getAllTechnologies,
  getFeaturedTechnologies,
  getTagsByIds
} from "@/lib/content";

export default function HomePage() {
  const featuredTechnologies = getFeaturedTechnologies();
  const recentTechnologies = getAllTechnologies().slice(0, 4);
  const hotSkills = getAllSkills().slice(0, 3);
  const classicKnowledge = getAllKnowledge().slice(0, 4);

  return (
    <PageShell
      title="Find what is worth understanding first"
      description="This local prototype connects new technologies, hot skills, and classic knowledge so readers can see what matters now and what still explains it."
    >
      <section className="hero">
        <div>
          <p className="eyebrow">Project foundation</p>
          <h1>Track new AI signals without losing the old ideas behind them.</h1>
          <p>
            The prototype uses local mock data only. It is designed to show
            structure, relationships, and readable pages before any crawling,
            ranking, push, or recommendation logic exists.
          </p>
        </div>
        <div className="hero__stats">
          <div className="stat-card">
            <strong>{getAllTechnologies().length}</strong>
            <span>Technology records</span>
          </div>
          <div className="stat-card">
            <strong>{getAllSkills().length}</strong>
            <span>Skill records</span>
          </div>
          <div className="stat-card">
            <strong>{getAllKnowledge().length}</strong>
            <span>Knowledge records</span>
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Today First</h2>
          <p>Editorially chosen demo items, not ranked output.</p>
        </div>
        <div className="content-grid">
          {featuredTechnologies.map((item) => (
            <ContentCard
              key={item.id}
              title={item.title}
              summary={item.summary}
              href={`/technologies/${item.slug}`}
              meta={[item.type, item.status, item.publishDate]}
              badges={
                <>
                  {getTagsByIds(item.tags).map((tag) => (
                    <TagBadge key={tag.id} tag={tag} />
                  ))}
                </>
              }
            />
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>New Technology Feed</h2>
          <p>Recent mock items that demonstrate the main relationship model.</p>
        </div>
        <div className="content-grid">
          {recentTechnologies.map((item) => (
            <ContentCard
              key={item.id}
              title={item.title}
              summary={item.summary}
              href={`/technologies/${item.slug}`}
              meta={[item.importanceLevel, item.publisherName]}
            />
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Hot Skills</h2>
          <p>Skills that help readers interpret and apply new signals.</p>
        </div>
        <div className="list-grid list-grid--three">
          {hotSkills.map((item) => (
            <ContentCard
              key={item.id}
              title={item.title}
              summary={item.summary}
              href={`/skills/${item.slug}`}
              meta={[item.skillType, item.heatLevel, item.learningCost]}
            />
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <h2>Classic Knowledge</h2>
          <p>Long-lived concepts that explain why the new items matter.</p>
        </div>
        <div className="content-grid">
          {classicKnowledge.map((item) => (
            <ContentCard
              key={item.id}
              title={item.title}
              summary={item.summary}
              href={`/knowledge/${item.slug}`}
              meta={[item.category, item.difficulty]}
            />
          ))}
        </div>
      </section>
    </PageShell>
  );
}
