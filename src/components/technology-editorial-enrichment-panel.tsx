"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type {
  EditorialEnrichmentGeneratedFields,
  EditorialEnrichmentGenerationMode,
  EditorialEnrichmentQualityLabel,
  EditorialEnrichmentSuggestion,
  TechnologyWorkspaceRecord
} from "@/types/content";

interface TechnologyEditorialEnrichmentPanelProps {
  record: TechnologyWorkspaceRecord;
  suggestions: EditorialEnrichmentSuggestion[];
}

const fieldLabels: Array<{
  key: keyof EditorialEnrichmentGeneratedFields;
  label: string;
}> = [
  { key: "whyItMatters", label: "为什么重要" },
  { key: "whoShouldCare", label: "谁该关注" },
  { key: "technicalContext", label: "技术背景" },
  { key: "impactAreas", label: "影响领域" },
  { key: "learningPath", label: "学习路径" },
  {
    key: "relatedKnowledgeExplanations",
    label: "知识关联说明"
  },
  { key: "relatedSkillExplanations", label: "技能关联说明" },
  { key: "followUpQuestions", label: "后续问题" },
  { key: "readingDifficulty", label: "阅读难度" }
];

const qualityLabelOptions: Array<{
  value: EditorialEnrichmentQualityLabel;
  label: string;
}> = [
  { value: "accurate", label: "准确" },
  { value: "clear", label: "清晰" },
  { value: "good_enough", label: "够用" },
  { value: "needs_human_edit", label: "需人工修改" },
  { value: "missing_context", label: "缺上下文" },
  { value: "too_generic", label: "过于泛化" },
  { value: "too_verbose", label: "过于冗长" },
  { value: "hallucination_risk", label: "幻觉风险" }
];

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join("\n") : "（空）";
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, string>);

    return entries.length > 0
      ? entries.map(([key, item]) => `${key}: ${item}`).join("\n")
      : "（空）";
  }

  return typeof value === "string" && value.trim() ? value : "（空）";
}

function getCurrentFieldValue(
  record: TechnologyWorkspaceRecord,
  key: keyof EditorialEnrichmentGeneratedFields
): unknown {
  return record[key as keyof TechnologyWorkspaceRecord];
}

function getStatusLabel(suggestion: EditorialEnrichmentSuggestion): string {
  if (suggestion.status === "draft") {
    return "待审阅";
  }

  if (suggestion.status === "applied") {
    return "已应用";
  }

  if (suggestion.status === "rejected") {
    return "已拒绝";
  }

  return "已过期";
}

function getGenerationModeLabel(
  mode: EditorialEnrichmentGenerationMode
): string {
  if (mode === "llm_assisted") {
    return "LLM 辅助";
  }

  if (mode === "mock_llm") {
    return "Mock LLM";
  }

  return "规则生成";
}

function formatConfidence(value: number | undefined): string {
  return typeof value === "number" ? `置信度 ${Math.round(value * 100)}%` : "";
}

function hasMeaningfulValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return typeof value === "string" && value.trim().length > 0;
}

function valuesDiffer(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) !== JSON.stringify(right ?? null);
}

export function TechnologyEditorialEnrichmentPanel({
  record,
  suggestions
}: TechnologyEditorialEnrichmentPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [qualityScore, setQualityScore] = useState("");
  const [qualityLabels, setQualityLabels] = useState<
    EditorialEnrichmentQualityLabel[]
  >([]);
  const [selectedFields, setSelectedFields] = useState<
    Array<keyof EditorialEnrichmentGeneratedFields>
  >(fieldLabels.map((field) => field.key));
  const [generationMode, setGenerationMode] =
    useState<EditorialEnrichmentGenerationMode>("rule_based");
  const [selectedSuggestionId, setSelectedSuggestionId] = useState(
    suggestions[0]?.id ?? ""
  );
  const selectedSuggestion =
    suggestions.find((suggestion) => suggestion.id === selectedSuggestionId) ??
    suggestions[0];
  const canReview = Boolean(selectedSuggestion);
  const canApply =
    record.status === "draft" &&
    selectedSuggestion &&
    ["draft", "stale"].includes(selectedSuggestion.status) &&
    selectedSuggestion.outputValidationStatus !== "failed" &&
    Object.keys(selectedSuggestion.generatedFields).length > 0;
  const canReject =
    selectedSuggestion &&
    ["draft", "stale"].includes(selectedSuggestion.status);

  function getFieldsThatOverwriteDraft(
    fieldsToApply: Array<keyof EditorialEnrichmentGeneratedFields>
  ): string[] {
    if (!selectedSuggestion) {
      return [];
    }

    return fieldLabels
      .filter((field) => fieldsToApply.includes(field.key))
      .filter((field) => {
        const currentValue = getCurrentFieldValue(record, field.key);
        const suggestedValue = selectedSuggestion.generatedFields[field.key];

        return (
          hasMeaningfulValue(currentValue) &&
          hasMeaningfulValue(suggestedValue) &&
          valuesDiffer(currentValue, suggestedValue)
        );
      })
      .map((field) => field.label);
  }

  function toggleQualityLabel(label: EditorialEnrichmentQualityLabel) {
    setQualityLabels((currentLabels) =>
      currentLabels.includes(label)
        ? currentLabels.filter((item) => item !== label)
        : [...currentLabels, label]
    );
  }

  function toggleSelectedField(key: keyof EditorialEnrichmentGeneratedFields) {
    setSelectedFields((currentFields) =>
      currentFields.includes(key)
        ? currentFields.filter((item) => item !== key)
        : [...currentFields, key]
    );
  }

  function buildReviewPayload(extra: Record<string, unknown> = {}) {
    return {
      qualityScore: qualityScore ? Number(qualityScore) : undefined,
      qualityLabels,
      reviewerNotes,
      rejectionReason,
      ...extra
    };
  }

  async function runAction(
    action: "generate" | "review" | "apply" | "reject",
    suggestionId?: string,
    fieldsToApply?: Array<keyof EditorialEnrichmentGeneratedFields>
  ) {
    if (action === "reject" && !rejectionReason.trim()) {
      setMessage("拒绝建议前请先填写拒绝原因。");
      return;
    }

    startTransition(async () => {
      setMessage("");

      try {
        const endpoint =
          action === "generate"
            ? `/api/workspace/technologies/${record.id}/enrichment/generate`
            : `/api/workspace/technologies/${record.id}/enrichment/${suggestionId}/${action}`;
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body:
            action === "generate"
              ? JSON.stringify({ generationMode })
              : JSON.stringify(buildReviewPayload({ fieldsToApply }))
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
          suggestion?: EditorialEnrichmentSuggestion;
        };

        if (!response.ok || !result.ok) {
          if (result.suggestion) {
            router.refresh();
          }

          throw new Error(result.message || "富化建议操作失败。");
        }

        setMessage(
          action === "generate"
            ? generationMode === "llm_assisted"
              ? "已生成 LLM 辅助建议。"
              : generationMode === "mock_llm"
                ? "已生成 Mock LLM 建议。"
                : "已生成规则建议。"
            : action === "review"
              ? "建议评审已保存。"
              : action === "apply"
                ? "建议已应用到所选草稿字段。"
                : "建议已拒绝。"
        );
        setReviewerNotes("");
        setRejectionReason("");
        setQualityScore("");
        setQualityLabels([]);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "富化建议操作失败。"
        );
      }
    });
  }

  function applySuggestionFields(
    suggestionId: string,
    fieldsToApply: Array<keyof EditorialEnrichmentGeneratedFields>
  ) {
    const overwriteLabels = getFieldsThatOverwriteDraft(fieldsToApply);

    if (
      overwriteLabels.length > 0 &&
      !window.confirm(
        `应用建议字段并覆盖以下草稿现有内容：${overwriteLabels.join("、")}？`
      )
    ) {
      return;
    }

    void runAction("apply", suggestionId, fieldsToApply);
  }

  function rejectSuggestion(suggestionId: string) {
    if (
      !window.confirm(
        "拒绝这条富化建议？建议会保留在工作台审计记录中，但不会更新草稿。"
      )
    ) {
      return;
    }

    void runAction("reject", suggestionId);
  }

  return (
    <section className="section-panel editorial-enrichment-panel">
      <div className="editorial-enrichment-panel__header">
        <div>
          <p className="eyebrow">编辑富化</p>
          <h2>提示词质量与建议评审</h2>
          <p>
            生成规则式或 LLM
            辅助的解释草稿，与当前内容智能字段对比，然后评审、应用所选字段或拒绝。建议在被应用之前只存在于工作台内。
          </p>
        </div>
        <div className="editorial-enrichment-panel__actions">
          <label className="field field--compact">
            <span>生成方式</span>
            <select
              value={generationMode}
              onChange={(event) =>
                setGenerationMode(
                  event.target.value as EditorialEnrichmentGenerationMode
                )
              }
            >
              <option value="rule_based">规则生成建议</option>
              <option value="llm_assisted">LLM 辅助建议</option>
              <option value="mock_llm">Mock LLM 建议</option>
            </select>
          </label>
          <button
            type="button"
            className="action-button action-button--accent"
            disabled={isPending}
            onClick={() => runAction("generate")}
          >
            {selectedSuggestion ? "重新生成富化建议" : "生成富化建议"}
          </button>
        </div>
      </div>

      {!selectedSuggestion ? (
        <p className="empty-state">这条草稿还没有生成过富化建议。</p>
      ) : (
        <>
          <div className="editorial-enrichment-panel__meta">
            <span
              className={`status-badge status-badge--${selectedSuggestion.status}`}
            >
              {getStatusLabel(selectedSuggestion)}
            </span>
            <span className="info-pill">
              评审 {selectedSuggestion.reviewStatus ?? "unreviewed"}
            </span>
            <span className="info-pill">
              {getGenerationModeLabel(selectedSuggestion.generationMode)}
            </span>
            {selectedSuggestion.promptVersionId ? (
              <span className="info-pill">
                提示词{" "}
                {selectedSuggestion.promptVersion ??
                  selectedSuggestion.promptVersionId}
              </span>
            ) : null}
            {selectedSuggestion.providerName ? (
              <span className="info-pill">
                提供方 {selectedSuggestion.providerName}
              </span>
            ) : null}
            {selectedSuggestion.modelName ? (
              <span className="info-pill">
                模型 {selectedSuggestion.modelName}
              </span>
            ) : null}
            {selectedSuggestion.outputValidationStatus ? (
              <span className="info-pill">
                校验 {selectedSuggestion.outputValidationStatus}
              </span>
            ) : null}
            {formatConfidence(selectedSuggestion.confidence) ? (
              <span className="info-pill">
                {formatConfidence(selectedSuggestion.confidence)}
              </span>
            ) : null}
            {selectedSuggestion.qualityScore ? (
              <span className="info-pill">
                质量 {selectedSuggestion.qualityScore}/5
              </span>
            ) : null}
            <span className="info-pill">
              创建于 {selectedSuggestion.createdAt.slice(0, 10)}
            </span>
          </div>

          {suggestions.length > 1 ? (
            <div className="editorial-enrichment-history">
              <h3>建议历史</h3>
              <div className="editorial-enrichment-history__items">
                {suggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion.id}
                    className={
                      suggestion.id === selectedSuggestion.id
                        ? "editorial-enrichment-history__item editorial-enrichment-history__item--active"
                        : "editorial-enrichment-history__item"
                    }
                    onClick={() => setSelectedSuggestionId(suggestion.id)}
                  >
                    <strong>{getStatusLabel(suggestion)}</strong>
                    <span>{suggestion.reviewStatus ?? "unreviewed"}</span>
                    <span>{suggestion.createdAt.slice(0, 10)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {selectedSuggestion.generationError ? (
            <p className="workspace-edit-form__hint workspace-edit-form__hint--warning">
              生成失败：{selectedSuggestion.generationError}
            </p>
          ) : null}

          {selectedSuggestion.limitations &&
          selectedSuggestion.limitations.length > 0 ? (
            <div className="editorial-enrichment-panel__notes">
              <h3>局限性</h3>
              <ul>
                {selectedSuggestion.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedSuggestion.outputValidationWarnings &&
          selectedSuggestion.outputValidationWarnings.length > 0 ? (
            <div className="editorial-enrichment-panel__notes">
              <h3>校验警告</h3>
              <ul>
                {selectedSuggestion.outputValidationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="editorial-enrichment-review">
            <label className="field field--compact">
              <span>质量评分</span>
              <select
                value={qualityScore}
                onChange={(event) => setQualityScore(event.target.value)}
              >
                <option value="">未评分</option>
                <option value="5">5 - 优秀</option>
                <option value="4">4 - 可用</option>
                <option value="3">3 - 需修改</option>
                <option value="2">2 - 较弱</option>
                <option value="1">1 - 应拒绝</option>
              </select>
            </label>
            <div className="editorial-enrichment-review__labels">
              <span>质量标签</span>
              <div>
                {qualityLabelOptions.map((option) => (
                  <label key={option.value} className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={qualityLabels.includes(option.value)}
                      onChange={() => toggleQualityLabel(option.value)}
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="editorial-enrichment-field-picker">
            <span>要应用的字段</span>
            <div>
              {fieldLabels.map((field) => {
                const hasSuggestion = hasMeaningfulValue(
                  selectedSuggestion.generatedFields[field.key]
                );

                return (
                  <label key={field.key} className="checkbox-pill">
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.key)}
                      disabled={!hasSuggestion}
                      onChange={() => toggleSelectedField(field.key)}
                    />
                    {field.label}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="editorial-enrichment-compare">
            {fieldLabels.map((field) => {
              const currentValue = getCurrentFieldValue(record, field.key);
              const suggestedValue =
                selectedSuggestion.generatedFields[field.key];
              const willOverwrite =
                selectedFields.includes(field.key) &&
                hasMeaningfulValue(suggestedValue) &&
                valuesDiffer(currentValue, suggestedValue);

              return (
                <article
                  key={field.key}
                  className="editorial-enrichment-compare__row"
                >
                  <h3>
                    {field.label}
                    {willOverwrite ? <span>将覆盖</span> : null}
                  </h3>
                  <div className="editorial-enrichment-compare__columns">
                    <div>
                      <span>当前草稿</span>
                      <p>{formatValue(currentValue)}</p>
                    </div>
                    <div>
                      <span>建议内容</span>
                      <p>{formatValue(suggestedValue)}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <label className="field">
            <span>评审备注</span>
            <textarea
              rows={3}
              value={reviewerNotes}
              onChange={(event) => setReviewerNotes(event.target.value)}
              placeholder="关于准确性、具体程度或所需修改的备注（可选）。"
            />
          </label>

          <label className="field">
            <span>拒绝原因</span>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="仅在拒绝这条建议时必填。"
            />
          </label>

          <div className="candidate-review-actions__buttons">
            <button
              type="button"
              className="action-button action-button--subtle"
              disabled={!canReview || isPending}
              onClick={() => runAction("review", selectedSuggestion.id)}
            >
              保存评审
            </button>
            <button
              type="button"
              className="action-button action-button--accent"
              disabled={!canApply || isPending}
              onClick={() =>
                applySuggestionFields(
                  selectedSuggestion.id,
                  fieldLabels.map((field) => field.key)
                )
              }
            >
              应用全部建议字段
            </button>
            <button
              type="button"
              className="action-button action-button--accent"
              disabled={!canApply || selectedFields.length === 0 || isPending}
              onClick={() =>
                applySuggestionFields(selectedSuggestion.id, selectedFields)
              }
            >
              应用所选建议字段
            </button>
            <button
              type="button"
              className="action-button action-button--subtle"
              disabled={!canReject || isPending}
              onClick={() => rejectSuggestion(selectedSuggestion.id)}
            >
              拒绝建议
            </button>
          </div>
        </>
      )}

      {message ? <p className="workspace-edit-form__hint">{message}</p> : null}

      {record.status !== "draft" ? (
        <p className="workspace-edit-form__hint">
          富化建议只能应用到草稿记录，因此生成内容无法直接修改已发布的内容。
        </p>
      ) : null}
    </section>
  );
}
