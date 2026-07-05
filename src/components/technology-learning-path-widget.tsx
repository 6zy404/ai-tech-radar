"use client";

import { useState, useTransition } from "react";

import type {
  TechnologyItem,
  TechnologyLearningPathFields
} from "@/types/content";

interface TechnologyLearningPathWidgetProps {
  technology: Pick<TechnologyItem, "id">;
}

const disclaimerText = "AI 生成内容，未经编辑审核，仅供参考。";

export function TechnologyLearningPathWidget({
  technology
}: TechnologyLearningPathWidgetProps) {
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
            "error" in payload
              ? payload.error
              : "学习路径生成失败，请稍后再试。"
          );
          return;
        }

        setFields(payload.fields);
      } catch {
        setError("学习路径生成失败，请稍后再试。");
      }
    });
  }

  return (
    <section className="user-article-section technology-detail-section technology-compare-widget technology-learning-path-widget">
      <p className="technology-detail-section__eyebrow">怎么学起</p>
      <h2>让 AI 生成一条学习路径</h2>
      <p className="technology-detail-section__lede">
        基于本页的相关知识和相关技能，AI 会现场生成一条从基础到应用的学习路径。
      </p>

      <div className="technology-compare-widget__controls">
        <button
          type="button"
          className="action-button action-button--accent"
          onClick={handleGenerate}
          disabled={isPending}
        >
          {isPending ? "生成中…" : "生成学习路径"}
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
            <span>路径总览</span>
            <p>{fields.overview}</p>
          </div>

          {fields.steps.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>学习步骤</span>
              <ol className="technology-detail-learning-list">
                {fields.steps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          ) : null}

          {fields.checkpoints && fields.checkpoints.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>自测点</span>
              <ul>
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
