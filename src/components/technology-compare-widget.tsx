"use client";

import { useState, useTransition } from "react";

import { aiGeneratedDisclaimer } from "@/lib/ai-disclaimer";
import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import { contentLangAttr, nameLangAttr } from "@/lib/i18n/text-lang";
import { useLocale } from "@/lib/i18n/use-locale";

import type {
  TechnologyComparisonFields,
  TechnologyItem
} from "@/types/content";

interface CompareCandidate {
  id: string;
  title: string;
  href: string;
}

interface TechnologyCompareWidgetProps {
  technology: Pick<TechnologyItem, "id">;
  candidates: CompareCandidate[];
}

export function TechnologyCompareWidget({
  technology,
  candidates
}: TechnologyCompareWidgetProps) {
  const locale = useLocale();
  const aiCopy = technologyDetailCopy[locale].ai;
  const copy = aiCopy.compare;
  const answerLang = contentLangAttr(locale);
  const disclaimer =
    locale === "zh" ? aiGeneratedDisclaimer : aiCopy.disclaimer;
  const [selectedId, setSelectedId] = useState(candidates[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<TechnologyComparisonFields | null>(null);
  const [error, setError] = useState("");

  if (candidates.length === 0) {
    return null;
  }

  function handleCompare() {
    if (!selectedId) {
      return;
    }

    startTransition(async () => {
      setError("");
      setFields(null);

      try {
        const response = await fetch("/api/technologies/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technologyIdA: technology.id,
            technologyIdB: selectedId
          })
        });
        const payload = (await response.json()) as
          { fields: TechnologyComparisonFields } | { error: string };

        if (!response.ok || "error" in payload) {
          setError(
            "error" in payload && locale === "zh"
              ? payload.error
              : aiCopy.failed.compare
          );
          return;
        }

        setFields(payload.fields);
      } catch {
        setError(aiCopy.failed.compare);
      }
    });
  }

  return (
    <section className="user-article-section technology-detail-section technology-compare-widget">
      <p className="technology-detail-section__eyebrow">{copy.eyebrow}</p>
      <h2>{copy.heading}</h2>
      <p className="technology-detail-section__lede">{copy.lede}</p>

      <div className="technology-compare-widget__controls">
        <select
          className="technology-compare-widget__select"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={isPending}
        >
          {candidates.map((candidate) => (
            <option
              key={candidate.id}
              value={candidate.id}
              lang={nameLangAttr(locale, candidate.title)}
            >
              {candidate.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={handleCompare}
          disabled={isPending || !selectedId}
        >
          {isPending ? aiCopy.pending : copy.submit}
        </button>
      </div>

      {error ? (
        <p className="technology-compare-widget__error">{error}</p>
      ) : null}

      {fields ? (
        <div className="technology-compare-widget__result">
          <p className="technology-compare-widget__disclaimer">{disclaimer}</p>

          {fields.similarities.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>{copy.similarities}</span>
              <ul lang={answerLang}>
                {fields.similarities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {fields.differences.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>{copy.differences}</span>
              <ul lang={answerLang}>
                {fields.differences.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="technology-compare-widget__block">
            <span>{copy.whenToPrefer}</span>
            <p lang={answerLang}>{fields.whenToPreferA}</p>
            <p lang={answerLang}>{fields.whenToPreferB}</p>
          </div>

          {fields.sharedConsiderations &&
          fields.sharedConsiderations.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>{copy.shared}</span>
              <ul lang={answerLang}>
                {fields.sharedConsiderations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
