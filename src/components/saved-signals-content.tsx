"use client";

import Link from "next/link";
import { useState } from "react";

import { DossierTechnologyCard } from "@/components/dossier-technology-card";
import { ReadFilterToggle } from "@/components/read-filter-toggle";
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
  const [hideRead, setHideRead] = useState(false);
  const [transferMessage, setTransferMessage] = useState("");
  const {
    savedIds,
    readIds,
    isLoaded,
    isRead,
    isSaved,
    toggleRead,
    toggleSaved
  } = useReadingState();

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
      href: `/technologies/${item.slug}`
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
      setTransferMessage(
        "阅读码已复制，在另一台设备的「稍后读」里点「导入阅读码」粘贴即可。"
      );
    } catch {
      window.prompt("复制这段阅读码，在另一台设备上导入：", code);
      setTransferMessage("");
    }
  };

  const handleImport = () => {
    const raw = window.prompt("粘贴另一台设备导出的阅读码：");

    if (raw === null) {
      return;
    }

    const decoded = decodeReadingCode(raw);

    if (!decoded) {
      setTransferMessage(
        "阅读码无效：应以 rm1: 开头。话题的关注码请到「我关注的」导入。"
      );
      return;
    }

    const result = mergeReadingCode(decoded, publishedIds, {
      savedIds,
      readIds
    });

    writeMarkedTechnologyIds("saved", result.next.savedIds);
    writeMarkedTechnologyIds("read", result.next.readIds);
    setTransferMessage(describeReadingImport(result));
  };

  const transferControls = (
    <div className="reading-transfer" role="group" aria-label="换设备">
      {canExport ? (
        <button type="button" className="quiet-button" onClick={handleExport}>
          导出阅读码
        </button>
      ) : null}
      <button type="button" className="quiet-button" onClick={handleImport}>
        导入阅读码
      </button>
    </div>
  );
  const transferStatus = transferMessage ? (
    <p className="reading-transfer__message" role="status">
      {transferMessage}
    </p>
  ) : null;

  if (!isLoaded) {
    return (
      <div className="saved-signals">
        <p className="saved-signals__lede">正在读取本地的稍后读列表…</p>
      </div>
    );
  }

  if (savedTechnologies.length === 0) {
    return (
      <div className="saved-signals">
        <div className="dossier-empty-state">
          <strong>你的稍后读还是空的。</strong>
          {/* The two sentences are one line on purpose: JSX joins wrapped text
              lines with a space, which lands inside Chinese prose. */}
          <p>
            在<Link href="/technologies">「精选」</Link>
            里看到想回头细读的信号，点一下「稍后读」，它就会攒到这里。标记只保存在这台设备的浏览器里。
          </p>
          <p>换了设备？把旧设备上导出的阅读码导入进来。</p>
          {transferControls}
          {transferStatus}
        </div>
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
          已攒下 {savedTechnologies.length} 条信号。
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
            mode="zh"
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
          <strong>攒下的信号你都读完了。</strong>
          <p>关掉「隐藏已读」可以回看，或者取消「稍后读」把它们清出列表。</p>
        </div>
      ) : null}

      <SignalShortcutHelp
        open={shortcuts.isHelpOpen}
        onClose={shortcuts.closeHelp}
        announcement={shortcuts.announcement}
      />
    </div>
  );
}
