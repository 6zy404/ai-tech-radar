"use client";

import { useState, useTransition } from "react";

import { UnbreakableTitle } from "@/components/unbreakable-title";
import { aiGeneratedDisclaimer } from "@/lib/ai-disclaimer";
import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import { contentLangAttr } from "@/lib/i18n/text-lang";
import { useLocale } from "@/lib/i18n/use-locale";

import type {
  TechnologyExplanationAudienceLevel,
  TechnologyExplanationFields,
  TechnologyItem
} from "@/types/content";

interface TechnologyExplainWidgetProps {
  technology: Pick<TechnologyItem, "id">;
}

const audienceLevels: TechnologyExplanationAudienceLevel[] = [
  "beginner",
  "intermediate",
  "advanced"
];

export function TechnologyExplainWidget({
  technology
}: TechnologyExplainWidgetProps) {
  const locale = useLocale();
  const aiCopy = technologyDetailCopy[locale].ai;
  const copy = aiCopy.explain;
  const answerLang = contentLangAttr(locale);
  const disclaimer =
    locale === "zh" ? aiGeneratedDisclaimer : aiCopy.disclaimer;
  const [selectedLevel, setSelectedLevel] =
    useState<TechnologyExplanationAudienceLevel>("intermediate");
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<TechnologyExplanationFields | null>(
    null
  );
  const [error, setError] = useState("");

  function handleExplain() {
    startTransition(async () => {
      setError("");
      setFields(null);

      try {
        const response = await fetch("/api/technologies/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            technologyId: technology.id,
            audienceLevel: selectedLevel
          })
        });
        const payload = (await response.json()) as
          { fields: TechnologyExplanationFields } | { error: string };

        if (!response.ok || "error" in payload) {
          setError(
            "error" in payload && locale === "zh"
              ? payload.error
              : aiCopy.failed.explain
          );
          return;
        }

        setFields(payload.fields);
      } catch {
        setError(aiCopy.failed.explain);
      }
    });
  }

  return (
    <section className="user-article-section technology-detail-section technology-compare-widget technology-explain-widget">
      <p className="technology-detail-section__eyebrow">{copy.eyebrow}</p>
      <h2>
        <UnbreakableTitle text={copy.heading} />
      </h2>
      <p className="technology-detail-section__lede">{copy.lede}</p>

      <div className="technology-compare-widget__controls">
        <select
          className="technology-compare-widget__select"
          value={selectedLevel}
          onChange={(event) =>
            setSelectedLevel(
              event.target.value as TechnologyExplanationAudienceLevel
            )
          }
          disabled={isPending}
          aria-label={copy.levelLabel}
        >
          {audienceLevels.map((level) => (
            <option key={level} value={level}>
              {copy.levels[level].label} · {copy.levels[level].description}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={handleExplain}
          disabled={isPending}
        >
          {isPending ? aiCopy.pending : copy.submit}
        </button>
        {/* Heard, not seen: the result arrives seconds after the press,
            below the button, and the button is disabled meanwhile. */}
        <p className="signal-shortcut-help__live" role="status">
          {isPending
            ? locale === "en"
              ? "Writing the explanation…"
              : "正在生成解读…"
            : fields
              ? locale === "en"
                ? "The explanation is ready below."
                : "解读已生成，见下方。"
              : ""}
        </p>
      </div>

      {error ? (
        <p className="technology-compare-widget__error" role="alert">
          {error}
        </p>
      ) : null}

      {fields ? (
        <div className="technology-compare-widget__result">
          <p className="technology-compare-widget__disclaimer">{disclaimer}</p>

          <div className="technology-compare-widget__block">
            <span>{copy.explanation}</span>
            <p lang={answerLang}>{fields.explanation}</p>
          </div>

          {fields.analogy ? (
            <div className="technology-compare-widget__block">
              <span>{copy.analogy}</span>
              <p lang={answerLang}>{fields.analogy}</p>
            </div>
          ) : null}

          {fields.keyPoints.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>{copy.keyPoints}</span>
              <ul lang={answerLang}>
                {fields.keyPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {fields.nextSteps && fields.nextSteps.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>{copy.nextSteps}</span>
              <ul lang={answerLang}>
                {fields.nextSteps.map((item) => (
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
