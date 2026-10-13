import Link from "next/link";
import type { ReactNode } from "react";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { TagList } from "@/components/tag-list";
import type { TopicTag } from "@/types/content";

interface HomeSignalCardProps {
  href: string;
  title: string;
  summary: string;
  priorityLabel: string;
  publishDate: string;
  noteLabel: string;
  note: string;
  footerItems?: string[];
  tags: TopicTag[];
  /** Out-of-flow stamp on the card's top edge (the 新 stamp). */
  stamp?: ReactNode;
}

/**
 * The home page's signal card, as plain props so the server-rendered
 * 现在最值得关注 row and the browser-computed 和你读过的相近 row draw the
 * same card.
 */
export function HomeSignalCard({
  href,
  title,
  summary,
  priorityLabel,
  publishDate,
  noteLabel,
  note,
  footerItems = [],
  tags,
  stamp
}: HomeSignalCardProps) {
  return (
    <DossierCard className="home-signal-card">
      {stamp}
      <div className="home-signal-card__meta">
        <DossierStampTag>{priorityLabel}</DossierStampTag>
        <span>{publishDate}</span>
      </div>
      <h3>
        <Link href={href}>{title}</Link>
      </h3>
      <p>{summary}</p>
      <DossierCatalogNote label={noteLabel}>{note}</DossierCatalogNote>
      <div className="home-signal-card__footer">
        {footerItems.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
      <TagList tags={tags} limit={2} />
    </DossierCard>
  );
}
