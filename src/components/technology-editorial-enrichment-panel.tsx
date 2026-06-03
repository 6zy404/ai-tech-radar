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
  { key: "whyItMatters", label: "Why it matters" },
  { key: "whoShouldCare", label: "Who should care" },
  { key: "technicalContext", label: "Technical context" },
  { key: "impactAreas", label: "Impact areas" },
  { key: "learningPath", label: "Learning path" },
  {
    key: "relatedKnowledgeExplanations",
    label: "Knowledge explanations"
  },
  { key: "relatedSkillExplanations", label: "Skill explanations" },
  { key: "followUpQuestions", label: "Follow-up questions" },
  { key: "readingDifficulty", label: "Reading difficulty" }
];

const qualityLabelOptions: Array<{
  value: EditorialEnrichmentQualityLabel;
  label: string;
}> = [
  { value: "accurate", label: "Accurate" },
  { value: "clear", label: "Clear" },
  { value: "good_enough", label: "Good enough" },
  { value: "needs_human_edit", label: "Needs human edit" },
  { value: "missing_context", label: "Missing context" },
  { value: "too_generic", label: "Too generic" },
  { value: "too_verbose", label: "Too verbose" },
  { value: "hallucination_risk", label: "Hallucination risk" }
];

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.join("\n") : "Empty";
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, string>);

    return entries.length > 0
      ? entries.map(([key, item]) => `${key}: ${item}`).join("\n")
      : "Empty";
  }

  return typeof value === "string" && value.trim() ? value : "Empty";
}

function getCurrentFieldValue(
  record: TechnologyWorkspaceRecord,
  key: keyof EditorialEnrichmentGeneratedFields
): unknown {
  return record[key as keyof TechnologyWorkspaceRecord];
}

function getStatusLabel(suggestion: EditorialEnrichmentSuggestion): string {
  if (suggestion.status === "draft") {
    return "Pending review";
  }

  if (suggestion.status === "applied") {
    return "Applied";
  }

  if (suggestion.status === "rejected") {
    return "Rejected";
  }

  return "Stale";
}

function getGenerationModeLabel(mode: EditorialEnrichmentGenerationMode): string {
  if (mode === "llm_assisted") {
    return "LLM-assisted";
  }

  if (mode === "mock_llm") {
    return "Mock LLM";
  }

  return "Rule-based";
}

function formatConfidence(value: number | undefined): string {
  return typeof value === "number" ? `${Math.round(value * 100)}% confidence` : "";
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
      setMessage("Add a rejection reason before rejecting the suggestion.");
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

          throw new Error(result.message || "Editorial enrichment action failed.");
        }

        setMessage(
          action === "generate"
            ? generationMode === "llm_assisted"
              ? "LLM-assisted suggestion generated."
              : generationMode === "mock_llm"
                ? "Mock LLM suggestion generated."
                : "Rule-based suggestion generated."
            : action === "review"
              ? "Suggestion review saved."
              : action === "apply"
                ? "Suggestion applied to selected draft fields."
                : "Suggestion rejected."
        );
        setReviewerNotes("");
        setRejectionReason("");
        setQualityScore("");
        setQualityLabels([]);
        router.refresh();
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Editorial enrichment action failed."
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
        `Apply suggestion fields and overwrite existing draft values for: ${overwriteLabels.join(
          ", "
        )}?`
      )
    ) {
      return;
    }

    void runAction("apply", suggestionId, fieldsToApply);
  }

  function rejectSuggestion(suggestionId: string) {
    if (
      !window.confirm(
        "Reject this enrichment suggestion? The suggestion will stay in the workspace audit trail but will not update the draft."
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
          <p className="eyebrow">Editorial Enrichment</p>
          <h2>Prompt quality and suggestion review</h2>
          <p>
            Generate a rule-based or LLM-assisted explanation draft, compare it
            with current Content Intelligence fields, then review, apply selected
            fields, or reject it. Suggestions stay workspace-only until applied.
          </p>
        </div>
        <div className="editorial-enrichment-panel__actions">
          <label className="field field--compact">
            <span>Generation mode</span>
            <select
              value={generationMode}
              onChange={(event) =>
                setGenerationMode(
                  event.target.value as EditorialEnrichmentGenerationMode
                )
              }
            >
              <option value="rule_based">Rule-based suggestion</option>
              <option value="llm_assisted">LLM-assisted suggestion</option>
              <option value="mock_llm">Mock LLM suggestion</option>
            </select>
          </label>
          <button
            type="button"
            className="action-button action-button--accent"
            disabled={isPending}
            onClick={() => runAction("generate")}
          >
            {selectedSuggestion
              ? "Regenerate enrichment suggestion"
              : "Generate enrichment suggestion"}
          </button>
        </div>
      </div>

      {!selectedSuggestion ? (
        <p className="empty-state">
          No enrichment suggestion has been generated for this draft yet.
        </p>
      ) : (
        <>
          <div className="editorial-enrichment-panel__meta">
            <span className={`status-badge status-badge--${selectedSuggestion.status}`}>
              {getStatusLabel(selectedSuggestion)}
            </span>
            <span className="info-pill">
              Review {selectedSuggestion.reviewStatus ?? "unreviewed"}
            </span>
            <span className="info-pill">
              {getGenerationModeLabel(selectedSuggestion.generationMode)}
            </span>
            {selectedSuggestion.promptVersionId ? (
              <span className="info-pill">
                Prompt {selectedSuggestion.promptVersion ?? selectedSuggestion.promptVersionId}
              </span>
            ) : null}
            {selectedSuggestion.providerName ? (
              <span className="info-pill">
                Provider {selectedSuggestion.providerName}
              </span>
            ) : null}
            {selectedSuggestion.modelName ? (
              <span className="info-pill">Model {selectedSuggestion.modelName}</span>
            ) : null}
            {selectedSuggestion.outputValidationStatus ? (
              <span className="info-pill">
                Validation {selectedSuggestion.outputValidationStatus}
              </span>
            ) : null}
            {formatConfidence(selectedSuggestion.confidence) ? (
              <span className="info-pill">
                {formatConfidence(selectedSuggestion.confidence)}
              </span>
            ) : null}
            {selectedSuggestion.qualityScore ? (
              <span className="info-pill">
                Quality {selectedSuggestion.qualityScore}/5
              </span>
            ) : null}
            <span className="info-pill">
              Created {selectedSuggestion.createdAt.slice(0, 10)}
            </span>
          </div>

          {suggestions.length > 1 ? (
            <div className="editorial-enrichment-history">
              <h3>Suggestion history</h3>
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
              Generation failed: {selectedSuggestion.generationError}
            </p>
          ) : null}

          {selectedSuggestion.limitations &&
          selectedSuggestion.limitations.length > 0 ? (
            <div className="editorial-enrichment-panel__notes">
              <h3>Limitations</h3>
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
              <h3>Validation warnings</h3>
              <ul>
                {selectedSuggestion.outputValidationWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="editorial-enrichment-review">
            <label className="field field--compact">
              <span>Quality score</span>
              <select
                value={qualityScore}
                onChange={(event) => setQualityScore(event.target.value)}
              >
                <option value="">Not scored</option>
                <option value="5">5 - strong</option>
                <option value="4">4 - usable</option>
                <option value="3">3 - needs edit</option>
                <option value="2">2 - weak</option>
                <option value="1">1 - reject</option>
              </select>
            </label>
            <div className="editorial-enrichment-review__labels">
              <span>Quality labels</span>
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
            <span>Fields to apply</span>
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
              const suggestedValue = selectedSuggestion.generatedFields[field.key];
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
                    {willOverwrite ? <span>Will overwrite</span> : null}
                  </h3>
                  <div className="editorial-enrichment-compare__columns">
                    <div>
                      <span>Current draft</span>
                      <p>{formatValue(currentValue)}</p>
                    </div>
                    <div>
                      <span>Suggested</span>
                      <p>{formatValue(suggestedValue)}</p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <label className="field">
            <span>Reviewer notes</span>
            <textarea
              rows={3}
              value={reviewerNotes}
              onChange={(event) => setReviewerNotes(event.target.value)}
              placeholder="Optional notes about accuracy, specificity, or edits needed."
            />
          </label>

          <label className="field">
            <span>Rejection reason</span>
            <textarea
              rows={3}
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Required only when rejecting this suggestion."
            />
          </label>

          <div className="candidate-review-actions__buttons">
            <button
              type="button"
              className="action-button action-button--subtle"
              disabled={!canReview || isPending}
              onClick={() => runAction("review", selectedSuggestion.id)}
            >
              Save review
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
              Apply all suggestion fields
            </button>
            <button
              type="button"
              className="action-button action-button--accent"
              disabled={!canApply || selectedFields.length === 0 || isPending}
              onClick={() =>
                applySuggestionFields(selectedSuggestion.id, selectedFields)
              }
            >
              Apply selected suggestion fields
            </button>
            <button
              type="button"
              className="action-button action-button--subtle"
              disabled={!canReject || isPending}
              onClick={() => rejectSuggestion(selectedSuggestion.id)}
            >
              Reject suggestion
            </button>
          </div>
        </>
      )}

      {message ? <p className="workspace-edit-form__hint">{message}</p> : null}

      {record.status !== "draft" ? (
        <p className="workspace-edit-form__hint">
          Applied enrichment is restricted to draft records so generated
          suggestions cannot directly alter already published content.
        </p>
      ) : null}
    </section>
  );
}
