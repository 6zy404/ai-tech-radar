"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { radarCopy } from "@/lib/i18n/copy/radar";
import { localePath, type Locale } from "@/lib/i18n/locale";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import { useLocale } from "@/lib/i18n/use-locale";
import {
  describeRadarMove,
  getRadarQuadrantLabel,
  getRadarRingLabel,
  radarHoldNotes,
  radarQuadrants,
  radarRings
} from "@/lib/radar-labels";
import {
  radarCenter,
  radarDotRadius,
  radarRingRadii,
  radarViewBox,
  type RadarDotPosition
} from "@/lib/radar-layout";
import type { RadarPublicEntry, RadarQuadrant } from "@/types/radar";

// The /radar picture and its text alternative. The SVG is aria-hidden and
// mouse-only; the list beside it carries every fact the picture does —
// number, name, ring, new or moved — and is what a keyboard or a screen
// reader uses. Clicking a dot opens the same list item a click on its
// summary would. Without JS the list still opens and closes: it is native
// <details>, rendered on the server.

const anchorPrefix = "radar-";

export function getRadarEntryAnchor(slug: string): string {
  return `${anchorPrefix}${slug}`;
}

/** Where each quadrant's name sits: the picture's four corners. */
const cornerLabels: Record<
  RadarQuadrant,
  { x: number; y: number; anchor: "start" | "end" }
> = {
  "models-training": { x: radarViewBox - 6, y: 22, anchor: "end" },
  "agents-applications": {
    x: radarViewBox - 6,
    y: radarViewBox - 10,
    anchor: "end"
  },
  "inference-deployment": { x: 6, y: radarViewBox - 10, anchor: "start" },
  "tools-methods": { x: 6, y: 22, anchor: "start" }
};

const ringLabelSize = 12;

function RadarPicture({
  entries,
  positions,
  selected,
  onSelect,
  locale
}: {
  locale: Locale;
  entries: RadarPublicEntry[];
  positions: Record<string, RadarDotPosition>;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const outer = radarRingRadii[radarRingRadii.length - 1];

  return (
    <svg
      className="radar-picture"
      viewBox={`0 0 ${radarViewBox} ${radarViewBox}`}
      aria-hidden="true"
      focusable="false"
    >
      <circle
        className="radar-picture__disc"
        cx={radarCenter}
        cy={radarCenter}
        r={outer}
      />
      {radarRingRadii.map((radius) => (
        <circle
          key={radius}
          className="radar-picture__ring"
          cx={radarCenter}
          cy={radarCenter}
          r={radius}
        />
      ))}
      <line
        className="radar-picture__axis"
        x1={radarCenter - outer}
        y1={radarCenter}
        x2={radarCenter + outer}
        y2={radarCenter}
      />
      <line
        className="radar-picture__axis"
        x1={radarCenter}
        y1={radarCenter - outer}
        x2={radarCenter}
        y2={radarCenter + outer}
      />

      {radarQuadrants.map((quadrant) => {
        const corner = cornerLabels[quadrant];

        return (
          <text
            key={quadrant}
            className="radar-picture__quadrant"
            x={corner.x}
            y={corner.y}
            textAnchor={corner.anchor}
          >
            {getRadarQuadrantLabel(quadrant, locale)}
          </text>
        );
      })}

      {/* Ring names written down the upper half of the vertical line, one
          character under another, each on a paper patch the line stops at.
          English names are words, so they sit across the line instead. */}
      {radarRings.map((ring, index) => {
        const inner = index === 0 ? 0 : radarRingRadii[index - 1];
        const middle = (inner + radarRingRadii[index]) / 2;

        if (locale === "en") {
          const label = getRadarRingLabel(ring, locale);
          // Bold 12px Latin runs about 0.62em a letter.
          const width = label.length * ringLabelSize * 0.62;

          return (
            <g key={ring} className="radar-picture__ring-label">
              <rect
                x={radarCenter - width / 2 - 3}
                y={radarCenter - middle - ringLabelSize / 2 - 3}
                width={width + 6}
                height={ringLabelSize + 6}
              />
              <text
                x={radarCenter}
                y={radarCenter - middle}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {label}
              </text>
            </g>
          );
        }

        const chars = Array.from(getRadarRingLabel(ring));
        const height = chars.length * (ringLabelSize + 1);
        const top = radarCenter - middle - height / 2;

        return (
          <g key={ring} className="radar-picture__ring-label">
            <rect
              x={radarCenter - ringLabelSize / 2 - 2}
              y={top - 3}
              width={ringLabelSize + 4}
              height={height + 6}
            />
            {chars.map((char, charIndex) => (
              <text
                key={charIndex}
                x={radarCenter}
                y={top + (charIndex + 0.5) * (ringLabelSize + 1)}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {char}
              </text>
            ))}
          </g>
        );
      })}

      {entries.map((entry) => {
        const position = positions[entry.slug];

        if (!position) {
          return null;
        }

        const classes = [
          "radar-dot",
          entry.change === "unchanged"
            ? "radar-dot--steady"
            : "radar-dot--changed",
          selected === entry.slug ? "radar-dot--selected" : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <g
            key={entry.slug}
            className={classes}
            transform={`translate(${position.x} ${position.y})`}
            onClick={() => onSelect(entry.slug)}
          >
            <title>{`${entry.number} ${entry.name} · ${getRadarRingLabel(entry.ring, locale)}`}</title>
            <circle r={radarDotRadius} />
            <text textAnchor="middle" dominantBaseline="central">
              {entry.number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function RadarEntryDetail({
  entry,
  locale
}: {
  entry: RadarPublicEntry;
  locale: Locale;
}) {
  const copy = radarCopy[locale];
  // Ring reasons, history reasons and skill / knowledge titles are Chinese.
  const zhLang = contentLangAttr(locale);

  return (
    <div className="radar-entry__detail">
      {entry.ring === "hold" ? (
        <p className="radar-entry__ring-note">{radarHoldNotes[locale]}</p>
      ) : null}
      <p className="radar-entry__reason" lang={zhLang}>
        {entry.ringReason}
      </p>

      {entry.evidence.length > 0 ? (
        <div className="radar-entry__block">
          <div className="radar-entry__label">{copy.evidence}</div>
          <ul className="radar-entry__signals">
            {entry.evidence.map((signal) => (
              <li key={signal.slug}>
                <time dateTime={signal.publishDate}>{signal.publishDate}</time>
                <Link
                  href={localePath(locale, `/technologies/${signal.slug}`)}
                  lang={signal.titleLang}
                >
                  {signal.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {entry.knowledge.length > 0 || entry.skills.length > 0 ? (
        <div className="radar-entry__block radar-entry__related">
          {entry.knowledge.length > 0 ? (
            <p>
              <span>{copy.relatedKnowledge}</span>
              {entry.knowledge.map((item, index) => (
                <span key={item.slug}>
                  {index > 0 ? copy.listSeparator : null}
                  <Link
                    href={localePath(locale, `/knowledge/${item.slug}`)}
                    lang={zhLang}
                  >
                    {item.title}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
          {entry.skills.length > 0 ? (
            <p>
              <span>{copy.relatedSkills}</span>
              {entry.skills.map((item, index) => (
                <span key={item.slug}>
                  {index > 0 ? copy.listSeparator : null}
                  <Link
                    href={localePath(locale, `/skills/${item.slug}`)}
                    lang={zhLang}
                  >
                    {item.title}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="radar-entry__block">
        <div className="radar-entry__label">{copy.history}</div>
        <ol className="radar-entry__history">
          {[...entry.history].reverse().map((line, index) => (
            <li key={`${line.date}-${index}`}>
              <time dateTime={line.date}>{line.date}</time>
              <span>
                {line.fromRing
                  ? describeRadarMove(line.fromRing, line.toRing, locale)
                  : copy.addedTo(getRadarRingLabel(line.toRing, locale))}
                {line.reason ? (
                  locale === "zh" ? (
                    copy.historyReason(line.reason)
                  ) : (
                    <>
                      {": "}
                      <span lang={zhLang}>{line.reason}</span>
                    </>
                  )
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function changeStamp(entry: RadarPublicEntry, locale: Locale): string | null {
  if (entry.change === "new") {
    return radarCopy[locale].newStamp;
  }

  if (entry.change === "moved" && entry.movedFrom) {
    return describeRadarMove(entry.movedFrom, entry.ring, locale);
  }

  return null;
}

export function RadarView({
  entries,
  positions
}: {
  entries: RadarPublicEntry[];
  positions: Record<string, RadarDotPosition>;
}) {
  const locale = useLocale();
  const copy = radarCopy[locale];
  const [selected, setSelected] = useState<string | null>(null);

  // Set by a click on the picture; the scroll waits for the commit that
  // opens the entry, so it measures the entry at its open height.
  const pendingScroll = useRef<string | null>(null);

  const select = useCallback((slug: string | null, scroll: boolean) => {
    pendingScroll.current = scroll ? slug : null;
    setSelected(slug);

    // The address names the open entry, so a link to it opens it; no
    // history entry per click.
    const hash = slug ? `#${getRadarEntryAnchor(slug)}` : "";
    const url = `${window.location.pathname}${window.location.search}${hash}`;
    window.history.replaceState(window.history.state, "", url);
  }, []);

  useEffect(() => {
    if (!selected || pendingScroll.current !== selected) {
      return;
    }

    pendingScroll.current = null;

    const element = document.getElementById(getRadarEntryAnchor(selected));
    const summary = element?.querySelector("summary");

    if (!element || !summary) {
      return;
    }

    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const top = summary.getBoundingClientRect().top;
    const bottom = element.getBoundingClientRect().bottom;

    // Only when the entry is not already in view — beside the picture on a
    // wide screen it usually is, and a jump would be noise. Under the
    // picture on a phone it never is.
    if (top < 80 || bottom > window.innerHeight) {
      element.scrollIntoView({
        behavior: reduce ? "auto" : "smooth",
        block: "start"
      });
    }

    summary.focus({ preventScroll: true });
  }, [selected]);

  // A link to #radar-<slug> opens that entry, on load and when the hash
  // changes on this page (a link to another entry, an edited address).
  useEffect(() => {
    const openFromHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1));

      if (!hash.startsWith(anchorPrefix)) {
        return;
      }

      const slug = hash.slice(anchorPrefix.length);

      if (entries.some((entry) => entry.slug === slug)) {
        // Opened and scrolled to by the effect above, once it has rendered.
        pendingScroll.current = slug;
        setSelected(slug);
      }
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);

    return () => window.removeEventListener("hashchange", openFromHash);
  }, [entries]);

  return (
    <div className="radar-layout">
      <div className="radar-figure">
        <RadarPicture
          entries={entries}
          positions={positions}
          selected={selected}
          onSelect={(slug) => select(slug === selected ? null : slug, true)}
          locale={locale}
        />
        <p className="radar-figure__key" aria-hidden="true">
          <span className="radar-key-dot radar-key-dot--steady" />
          {copy.keySteady}
          <span className="radar-key-dot radar-key-dot--changed" />
          {copy.keyChanged}
        </p>
      </div>

      <div className="radar-list">
        {radarQuadrants.map((quadrant) => {
          const items = entries.filter((entry) => entry.quadrant === quadrant);

          if (items.length === 0) {
            return null;
          }

          return (
            <section
              key={quadrant}
              className="radar-list__quadrant"
              aria-labelledby={`radar-quadrant-${quadrant}`}
            >
              <h2 id={`radar-quadrant-${quadrant}`}>
                {getRadarQuadrantLabel(quadrant, locale)}
                <span>{copy.quadrantCount(items.length)}</span>
              </h2>
              <ol>
                {items.map((entry) => {
                  const stamp = changeStamp(entry, locale);

                  return (
                    <li key={entry.slug}>
                      <details
                        id={getRadarEntryAnchor(entry.slug)}
                        className={`radar-entry${
                          entry.change === "unchanged"
                            ? ""
                            : " radar-entry--changed"
                        }`}
                        open={selected === entry.slug}
                        onToggle={(event) => {
                          const open = event.currentTarget.open;

                          if (open && selected !== entry.slug) {
                            select(entry.slug, false);
                          } else if (!open && selected === entry.slug) {
                            select(null, false);
                          }
                        }}
                      >
                        <summary>
                          <span className="radar-entry__number">
                            {entry.number}
                          </span>
                          <span
                            className="radar-entry__name"
                            lang={nameLangAttr(locale, entry.name)}
                          >
                            {entry.name}
                          </span>
                          <span className="radar-entry__ring">
                            · {getRadarRingLabel(entry.ring, locale)}
                          </span>
                          {stamp ? (
                            <span className="radar-entry__change">{stamp}</span>
                          ) : null}
                        </summary>
                        <RadarEntryDetail entry={entry} locale={locale} />
                      </details>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}
