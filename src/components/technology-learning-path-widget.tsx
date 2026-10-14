"use client";

import { useState, useTransition } from "react";

import { aiGeneratedDisclaimer } from "@/lib/ai-disclaimer";
import { technologyDetailCopy } from "@/lib/i18n/copy/technology-detail";
import { contentLangAttr } from "@/lib/i18n/text-lang";
import { useLocale } from "@/lib/i18n/use-locale";

import type {
  TechnologyItem,
  TechnologyLearningPathFields
} from "@/types/content";

interface TechnologyLearningPathWidgetProps {
  technology: Pick<TechnologyItem, "id">;
}

export function TechnologyLearningPathWidget({
  technology
}: TechnologyLearningPathWidgetProps) {
  const locale = useLocale();
  const aiCopy = technologyDetailCopy[locale].ai;
  const copy = aiCopy.learningPath;
  const answerLang = contentLangAttr(locale);
  const disclaimer =
    locale === "zh" ? aiGeneratedDisclaimer : aiCopy.disclaimer;
  const [isPending, startTransition] = useTransition();
  const [fields, setFields] = useState<TechnologyLearningPathFields | null>(
    null
  );
  const [error, setError] = useState("");

  function handleGenerate() {
    startTransition(async () => {
      setError("");
      setFields(null);

      try {
        const response = await fetch("/api/technologies/learning-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ technologyId: technology.id })
        });
        const payload = (await response.json()) as
          { fields: TechnologyLearningPathFields } | { error: string };

        if (!response.ok || "error" in payload) {
          setError(
            "error" in payload && locale === "zh"
              ? payload.error
              : aiCopy.failed.learningPath
          );
          return;
        }

        setFields(payload.fields);
      } catch {
        setError(aiCopy.failed.learningPath);
      }
    });
  }

  return (
    <section className="user-article-section technology-detail-section technology-compare-widget technology-learning-path-widget">
      <p className="technology-detail-section__eyebrow">{copy.eyebrow}</p>
      <h2>{copy.heading}</h2>
      <p className="technology-detail-section__lede">{copy.lede}</p>

      <div className="technology-compare-widget__controls">
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending ? aiCopy.pending : copy.submit}
        </button>
        {/* Heard, not seen: the result arrives seconds after the press,
            below the button, and the button is disabled meanwhile. */}
        <p className="signal-shortcut-help__live" role="status">
          {isPending
            ? locale === "en"
              ? "Writing the learning path…"
              : "正在生成学习路径…"
            : fields
              ? locale === "en"
                ? "The learning path is ready below."
                : "学习路径已生成，见下方。"
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
            <span>{copy.overview}</span>
            <p lang={answerLang}>{fields.overview}</p>
          </div>

          {fields.steps.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>{copy.steps}</span>
              <ol className="technology-detail-learning-list" lang={answerLang}>
                {fields.steps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {fields.checkpoints && fields.checkpoints.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>{copy.checkpoints}</span>
              <ul lang={answerLang}>
                {fields.checkpoints.map((item) => (
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
