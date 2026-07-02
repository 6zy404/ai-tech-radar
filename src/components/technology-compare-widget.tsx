"use client";

import { useState, useTransition } from "react";

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

const disclaimerText = "AI 生成内容，未经编辑审核，仅供参考。";

export function TechnologyCompareWidget({
  technology,
  candidates
}: TechnologyCompareWidgetProps) {
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
          | { fields: TechnologyComparisonFields }
          | { error: string };

        if (!response.ok || "error" in payload) {
          setError(
            "error" in payload ? payload.error : "对比生成失败，请稍后再试。"
          );
          return;
        }

        setFields(payload.fields);
      } catch {
        setError("对比生成失败，请稍后再试。");
      }
    });
  }

  return (
    <section className="user-article-section technology-detail-section technology-compare-widget">
      <p className="technology-detail-section__eyebrow">技术对比</p>
      <h2>对比另一项技术</h2>
      <p className="technology-detail-section__lede">
        选择另一项已发布技术，让 AI 现场生成一份相似点、差异点和适用场景的对比。
      </p>

      <div className="technology-compare-widget__controls">
        <select
          className="technology-compare-widget__select"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={isPending}
        >
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
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
          {isPending ? "生成中…" : "生成对比"}
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

          {fields.similarities.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>相似点</span>
              <ul>
                {fields.similarities.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {fields.differences.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>差异点</span>
              <ul>
                {fields.differences.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="technology-compare-widget__block">
            <span>各自适用场景</span>
            <p>{fields.whenToPreferA}</p>
            <p>{fields.whenToPreferB}</p>
          </div>

          {fields.sharedConsiderations && fields.sharedConsiderations.length > 0 ? (
            <div className="technology-compare-widget__block">
              <span>共同注意事项</span>
              <ul>
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
