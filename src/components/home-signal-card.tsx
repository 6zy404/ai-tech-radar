import Link from "next/link";
import type { ReactNode } from "react";

import { DossierCard } from "@/components/dossier-card";
import { DossierCatalogNote } from "@/components/dossier-catalog-note";
import { DossierStampTag } from "@/components/dossier-stamp-tag";
import { LangSpan } from "@/components/lang-scope";
import { SignalAudienceLine } from "@/components/signal-audience-line";
import { TagList } from "@/components/tag-list";
import type { Locale } from "@/lib/i18n/locale";
import type { TopicTag } from "@/types/content";

interface HomeSignalCardProps {
  href: string;
  title: string;
  summary: string;
  priorityLabel: string;
  publishDate: string;
  noteLabel: string;
  note: string;
  locale: Locale;
  /** Who should care, as a 适合 … line; up to three names. */
  audience?: string[];
  /** The reading-difficulty label, the one chip the footer keeps. */
  difficulty?: string;
  tags: TopicTag[];
  /** Out-of-flow stamp on the card's top edge (the 新 stamp). */
  stamp?: ReactNode;
  /** `lang` of title / summary / note where it differs from the page. */
  titleLang?: string;
  summaryLang?: string;
  noteLang?: string;
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
  locale,
  audience = [],
  difficulty,
  tags,
  stamp,
  titleLang,
  summaryLang,
  noteLang
}: HomeSignalCardProps) {
  return (
    <DossierCard className="home-signal-card">
      {stamp}
      <div className="home-signal-card__meta">
        <DossierStampTag>{priorityLabel}</DossierStampTag>
        <span>{publishDate}</span>
      </div>
      <h3 lang={titleLang}>
        <Link href={href}>{title}</Link>
      </h3>
      <p lang={summaryLang}>{summary}</p>
      <DossierCatalogNote label={noteLabel}>
        <LangSpan lang={noteLang}>{note}</LangSpan>
      </DossierCatalogNote>
      <SignalAudienceLine
        audience={audience}
        locale={locale}
        className="home-signal-card__audience"
      />
      {difficulty ? (
        <div className="home-signal-card__footer">
          <span>{difficulty}</span>
        </div>
      ) : null}
      <TagList tags={tags} limit={2} />
    </DossierCard>
  );
}
