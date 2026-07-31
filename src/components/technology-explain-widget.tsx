"use client";

import { useState, useTransition } from "react";

import { UnbreakableTitle } from "@/components/unbreakable-title";
import type {
  TechnologyExplanationAudienceLevel,
  TechnologyExplanationFields,
  TechnologyItem
} from "@/types/content";

interface TechnologyExplainWidgetProps {
  technology: Pick<TechnologyItem, "id">;
}

const disclaimerText = "AI 生成内容，未经编辑审核，仅供参考。";

const audienceLevelOptions: {
  value: TechnologyExplanationAudienceLevel;
  label: string;
  description: string;
}[] = [
  { value: "beginner", label: "入门", description: "刚接触 AI 工程" },
  { value: "intermediate", label: "进阶", description: "熟悉常见概念" },
  { value: "advanced", label: "资深", description: "想要技术要点" }
];

export function TechnologyExplainWidget({
  technology
}: TechnologyExplainWidgetProps) {
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
            "error" in payload ? payload.error : "解读生成失败，请稍后再试。"
          );
          return;
        }

        setFields(payload.fields);
      } catch {
        setError("解读生成失败，请稍后再试。");
      }
    });
  }

  return (
    <section className="user-article-section technology-detail-section technology-compare-widget technology-explain-widget">
      <p className="technology-detail-section__eyebrow">按你的水平解读</p>
      <h2>
        <UnbreakableTitle text="让 AI 按你的水平解读这个信号" />
      </h2>
      <p className="technology-detail-section__lede">
        选择你的经验水平，AI 会现场生成一份为这个水平定制的解读。
      </p>

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
          aria-label="选择经验水平"
        >
          {audienceLevelOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} · {option.description}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={handleExplain}
          disabled={isPending}
        >
          {isPending ? "生成中…" : "生成解读"}
        </button>
      </div>

      {error ? (
        <p className="technology-compare-widget__error">{error}</p>
      ) : null}

      {fields ? (
        <div className="technology-compare-widget__result">
          <p className="technology-compare-widget__disclaimer">
            {disclaimerText}
          </p>

          <div className="technology-compare-widget__block">
            <span>解读</span>
            <p>{fields.explanation}</p>
          </div>

          {fields.analogy ? (
            <div className="technology-compare-widget__block">
              <span>打个比方</span>
              <p>{fields.analogy}</p>
            </div>
          ) : null}

          {fields.keyPoints.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>关键要点</span>
              <ul>
                {fields.keyPoints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {fields.nextSteps && fields.nextSteps.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>下一步建议</span>
              <ul>
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
