import Link from "next/link";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { LangSpan } from "@/components/lang-scope";
import { SectionHeading } from "@/components/section-link";
import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import type { Locale } from "@/lib/i18n/locale";
import type { RelationListItem } from "@/types/content";

interface DossierRelatedItemsSectionProps {
  /** Anchor for the page's table of contents. */
  id?: string;
  /**
   * The host page's public path. Given (with `id`), the heading gets a 「#」
   * that copies the section's address; omitted, the heading is a bare h2.
   */
  sharePath?: string;
  title: string;
  description?: string;
  items: RelationListItem[];
  linkLabel?: string;
  formatRelationType?: (
    relationType: RelationListItem["relationType"]
  ) => string;
  locale?: Locale;
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
  id,
  sharePath,
  title,
  description,
  items,
  linkLabel,
  formatRelationType,
  locale = "zh"
}: DossierRelatedItemsSectionProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section id={id} className="dossier-related-section" aria-label={title}>
      <div className="dossier-related-section__header">
        <SectionHeading sectionId={id} sharePath={sharePath}>
          {title}
        </SectionHeading>
        {description ? <p>{description}</p> : null}
      </div>

      <div className="dossier-related-section__list">
        {items.map((item) => (
          <DossierCard
            key={`${item.id}-${item.relationType}`}
            className="dossier-related-section__item"
          >
            <div className="dossier-related-section__topline">
              <h3 lang={item.titleLang}>
                <Link href={item.href}>{item.title}</Link>
              </h3>
              <DossierStampTag>
                {formatRelationType
                  ? formatRelationType(item.relationType)
                  : item.relationType}
              </DossierStampTag>
            </div>
            {item.note ? (
              <DossierCatalogNote locale={locale}>
                <LangSpan lang={item.noteLang}>{item.note}</LangSpan>
              </DossierCatalogNote>
            ) : null}
            <Link className="dossier-related-section__link" href={item.href}>
              {linkLabel ?? technologyDetailCopy[locale].related.linkLabel} →
            </Link>
          </DossierCard>
        ))}
      </div>
    </section>
  );
}
