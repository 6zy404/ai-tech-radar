import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import type { RelationListItem } from "@/types/content";

interface DossierRelatedItemsSectionProps {
  title: string;
  description?: string;
  items: RelationListItem[];
  linkLabel?: string;
  formatRelationType?: (
    relationType: RelationListItem["relationType"]
  ) => string;
}

/**
 * Dossier-direction rendering of the technology detail page's related-item
 * sections (相关技术 / 相关技能 / 相关知识). Renders each connection's note
 * through DossierCatalogNote — the "附注" pattern the 2026-07-14 design
 * session called out as the defining reuse of real Content Intelligence
 * data (relatedSkillExplanations / relatedKnowledgeExplanations), not just a
 * restyle. Deliberately a page-specific sibling of RelatedItemsSection
 * (kept unchanged) rather than a variant prop, since that component is still
 * shared with the not-yet-migrated skill and knowledge detail pages.
 */
export function DossierRelatedItemsSection({
  title,
  description,
  items,
  linkLabel = "查看相关信号",
  formatRelationType
}: DossierRelatedItemsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="dossier-related-section" aria-label={title}>
      <div className="dossier-related-section__header">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="dossier-related-section__list">
        {items.map((item) => (
          <DossierCard
            key={`${item.id}-${item.relationType}`}
            className="dossier-related-section__item"
          >
            <div className="dossier-related-section__topline">
              <h3>
                <Link href={item.href}>{item.title}</Link>
              </h3>
              <DossierStampTag>
                {formatRelationType
                  ? formatRelationType(item.relationType)
                  : item.relationType}
              </DossierStampTag>
            </div>
            {item.note ? (
              <DossierCatalogNote>{item.note}</DossierCatalogNote>
            ) : null}
            <Link className="dossier-related-section__link" href={item.href}>
              {linkLabel} →
            </Link>
          </DossierCard>
        ))}
      </div>
    </section>
  );
}
