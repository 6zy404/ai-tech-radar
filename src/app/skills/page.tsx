import { ContentCard } from "@/components/content-card";
import { PageShell } from "@/components/page-shell";
import { getAllSkills } from "@/lib/content";

export default function SkillsPage() {
  const skills = getAllSkills();

  return (
    <PageShell
      title="Hot Skills"
      description="A static list of practice areas that help users interpret and apply the new technology feed."
    >
      <div className="content-grid">
        {skills.map((skill) => (
          <ContentCard
            key={skill.id}
            title={skill.title}
            summary={skill.summary}
            href={`/skills/${skill.slug}`}
            meta={[skill.skillType, skill.heatLevel, skill.learningCost]}
          />
        ))}
      </div>
    </PageShell>
  );
}
