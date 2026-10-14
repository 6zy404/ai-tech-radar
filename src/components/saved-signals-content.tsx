"use client";

import Link from "next/link";
import { useState } from "react";

import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { ReadFilterToggle } from "@/components/read-filter-toggle";
import { SavedRecommendations } from "@/components/saved-recommendations";
import { SignalReadingActions } from "@/components/signal-reading-actions";
import {
  SignalShortcutHelp,
  SignalShortcutHint
} from "@/components/signal-shortcut-help";
import { useReadingState } from "@/components/use-reading-state";
import { useSignalShortcuts } from "@/components/use-signal-shortcuts";
import {
  applyReadFilter,
  countReadTechnologies,
  selectSavedTechnologies,
  writeMarkedTechnologyIds
} from "@/lib/reading-state";
import {
  countExportableMarks,
  decodeReadingCode,
  describeReadingImport,
  encodeReadingCode,
  mergeReadingCode
} from "@/lib/reading-transfer";
import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/use-locale";
import type { TechnologyItem, TopicTag } from "@/types/content";

interface SavedSignalsContentProps {
  technologies: TechnologyItem[];
  tags: TopicTag[];
}

/**
 * The 稍后读 view on /technologies. Like the 我关注的 view, the served
 * content is identical for everyone — the reading marks live only in the
 * reader's browser, so this component resolves them client-side.
 */
export function SavedSignalsContent({
  technologies,
  tags
}: SavedSignalsContentProps) {
  const locale = useLocale();
  const copy = signalsCopy[locale].saved;
  const [hideRead, setHideRead] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const readingState = useReadingState();
  const {
    savedIds,
    readIds,
    isLoaded,
    isRead,
    isSaved,
    toggleRead,
    toggleSaved
  } = readingState;

  const savedTechnologies = selectSavedTechnologies(technologies, savedIds);
  const readCount = countReadTechnologies(savedTechnologies, readIds);
  const shownTechnologies = applyReadFilter(
    savedTechnologies,
    readIds,
    hideRead
  );
  const shortcuts = useSignalShortcuts({
    signals: shownTechnologies.map((item) => ({
      id: item.id,
      href: localePath(locale, `/technologies/${item.slug}`)
    })),
    isRead,
    isSaved,
    toggleRead,
    toggleSaved,
    // Nothing to move between until the local list has been read.
    enabled: isLoaded && savedTechnologies.length > 0
  });

  const publishedIds = technologies.map((item) => item.id);
  const canExport =
    countExportableMarks({ savedIds, readIds }, publishedIds) > 0;

  // Same mechanics as the 关注码 in my-radar-content.tsx: clipboard first,
  // a prompt to copy from when the clipboard is refused, a prompt to paste
  // into. The code never leaves the browser.
  const handleExport = async () => {
    const code = encodeReadingCode({ savedIds, readIds }, publishedIds);

    try {
      await navigator.clipboard.writeText(code);
      setTransferMessage(copy.exported);
    } catch {
      window.prompt(copy.copyPrompt, code);
      setTransferMessage("");
    }
  };

  const handleImport = () => {
    const raw = window.prompt(copy.pastePrompt);

    if (raw === null) {
      return;
    }

    const decoded = decodeReadingCode(raw);

    if (!decoded) {
      setTransferMessage(copy.invalidCode);
      return;
    }

    const result = mergeReadingCode(decoded, publishedIds, {
      savedIds,
      readIds
    });

    writeMarkedTechnologyIds("saved", result.next.savedIds);
    writeMarkedTechnologyIds("read", result.next.readIds);
    setTransferMessage(describeReadingImport(result, locale));
  };

  const transferControls = (
    <div
      className="reading-transfer"
      role="group"
      aria-label={copy.transferLabel}
    >
      {canExport ? (
        <button type="button" className="quiet-button" onClick={handleExport}>
          {copy.export}
        </button>
      ) : null}
      <button type="button" className="quiet-button" onClick={handleImport}>
        {copy.import}
      </button>
    </div>
  );
  // 和你读过的相近: computed in the browser from these same marks; renders
  // nothing until there is at least one recommendation.
  const recommendations = (
    <SavedRecommendations
      technologies={technologies}
      tags={tags}
      readingState={readingState}
    />
  );
  const transferStatus = transferMessage ? (
    <p className="reading-transfer__message" role="status">
      {transferMessage}
    </p>
  ) : null;

  if (!isLoaded) {
    return (
      <div className="saved-signals">
        <p className="saved-signals__lede">{copy.loading}</p>
      </div>
    );
  }

  if (savedTechnologies.length === 0) {
    return (
      <div className="saved-signals">
        <div className="dossier-empty-state">
          <strong>{copy.emptyTitle}</strong>
          {/* The two sentences are one line on purpose: JSX joins wrapped text
              lines with a space, which lands inside Chinese prose. */}
          <p>
            {copy.emptyBefore}
            <Link href={localePath(locale, "/technologies")}>
              {copy.emptyLink}
            </Link>
            {copy.emptyAfter}
          </p>
          <p>{copy.emptyImport}</p>
          {transferControls}
          {transferStatus}
        </div>
        {recommendations}
      </div>
    );
  }

  return (
    <div className="saved-signals">
      {/* Same reason as the curated view's toolbar: the read filter shares an
          always-present row instead of owning one, so marking the first signal
          read does not push the list down. */}
      <div className="saved-signals__toolbar">
        <p className="saved-signals__lede">
          {/* The ordering is already stated by the page description above;
              this row exists for the count and to host the read filter. */}
          {copy.count(savedTechnologies.length)}
        </p>

        <div className="saved-signals__toolbar-controls">
          <ReadFilterToggle
            readCount={readCount}
            hideRead={hideRead}
            onToggle={() => setHideRead((current) => !current)}
          />
          <SignalShortcutHint onOpen={shortcuts.openHelp} />
          {transferControls}
        </div>
      </div>

      {transferStatus}

      <div className="dossier-technology-list">
        {shownTechnologies.map((item) => (
          <DossierTechnologyCard
            key={item.id}
            technology={item}
            mode={locale === "en" ? "original" : "zh"}
            locale={locale}
            isRead={isRead(item.id)}
            isCurrent={shortcuts.currentId === item.id}
            readingActions={
              <SignalReadingActions
                isRead={isRead(item.id)}
                isSaved={isSaved(item.id)}
                onToggleRead={() => toggleRead(item.id)}
                onToggleSaved={() => toggleSaved(item.id)}
              />
            }
            tags={item.tags
              .map((tagId) => tags.find((tag) => tag.id === tagId))
              .filter((tag): tag is TopicTag => Boolean(tag))}
          />
        ))}
      </div>

      {shownTechnologies.length === 0 ? (
        <div className="dossier-empty-state">
          <strong>{copy.allReadTitle}</strong>
          <p>{copy.allReadBody}</p>
        </div>
      ) : null}

      {recommendations}

      <SignalShortcutHelp
        open={shortcuts.isHelpOpen}
        onClose={shortcuts.closeHelp}
        announcement={shortcuts.announcement}
      />
    </div>
  );
}
