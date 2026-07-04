export type ContentKind = "technology" | "skill" | "knowledge";

export type TechnologyType =
  "platform" | "tool" | "model" | "protocol" | "workflow";

export type PublisherType =
  "big-tech" | "startup" | "research-lab" | "open-source-community" | "media";

export type ImportanceLevel = "signal" | "important" | "critical";

export type TechnologyStatus = "draft" | "published" | "archived";

export type ReadingDifficulty = "beginner" | "intermediate" | "advanced";

export type IntelligenceStatus = "draft" | "reviewed" | "needs_enrichment";

export type EditorialEnrichmentSuggestionStatus =
  "draft" | "applied" | "rejected" | "stale";

export type EditorialEnrichmentGenerationMode =
  "rule_based" | "llm_assisted" | "mock_llm" | "ai_assisted_placeholder";

export type EditorialEnrichmentOutputValidationStatus =
  "not_applicable" | "valid" | "warning" | "failed";

export type PromptVersionStatus = "active" | "draft" | "deprecated";

export type PromptPurpose = "editorial_enrichment" | "technology_comparison";

export type EditorialEnrichmentReviewStatus =
  "unreviewed" | "accepted" | "partially_accepted" | "rejected";

export type EditorialEnrichmentQualityLabel =
  | "accurate"
  | "clear"
  | "too_generic"
  | "too_verbose"
  | "missing_context"
  | "hallucination_risk"
  | "needs_human_edit"
  | "good_enough";

export type DailyDigestStatus = "draft" | "published" | "archived";

export type DeliveryChannelType =
  "webhook" | "feishu_webhook" | "email" | "telegram" | "discord";

export type DeliveryFormat = "json" | "text";

export type DeliveryStatus = "pending" | "success" | "failed";

export type ScheduledDeliveryDigestTarget =
  "latest_published_digest" | "digest_by_date";

export type ScheduledDeliveryRunStatus =
  "never_run" | "success" | "failed" | "partial";

export type ScheduledDeliveryTriggerType = "scheduled" | "manual" | "retry";

export type TaskRunnerMode = "run_once" | "watch";

export type TaskRunnerStatus = "success" | "failed" | "partial";

export type WorkflowEventActorType =
  "system" | "workspace_user" | "task_runner";

export type WorkflowEventAction =
  | "candidate.status_updated"
  | "candidate.converted_to_draft"
  | "candidate.convert_failed"
  | "duplicate_group.updated"
  | "duplicate_group.resolved"
  | "draft.updated"
  | "draft.published"
  | "draft.publish_failed"
  | "editorial_enrichment.generated"
  | "editorial_enrichment.failed"
  | "editorial_enrichment.applied"
  | "editorial_enrichment.rejected"
  | "editorial_enrichment.stale"
  | "prompt_version.created"
  | "enrichment_suggestion.generated"
  | "enrichment_suggestion.reviewed"
  | "enrichment_suggestion.applied"
  | "enrichment_suggestion.rejected"
  | "enrichment_suggestion.marked_stale"
  | "digest.generated"
  | "digest.updated"
  | "digest.published"
  | "digest.publish_failed"
  | "delivery.sent"
  | "delivery.failed"
  | "schedule.run"
  | "schedule.run_failed"
  | "task_runner.run"
  | "source.imported";

export type SourceLanguage = "en" | "zh";

export type TranslationStatus = "not_needed" | "pending" | "done" | "failed";

export type ImportedSourceType =
  "rss-feed" | "github-release" | "official-blog";

export type ExternalSourceType =
  "rss" | "atom" | "github_release" | "official_blog";

export type ExternalSourceImportStatus =
  "never_run" | "success" | "failed" | "partial";

export type SourceQualityLevel = "good" | "watch" | "poor" | "unknown";

export type PriorityLevel = "high_priority" | "watch" | "low_priority";

export type RankingSource = "rule_based" | "manual_override";

export type CandidateNormalizedType = TechnologyType | "unknown";

export type CandidateImportStatus =
  "new" | "reviewed" | "converted" | "rejected";

export type CandidateQualityFlag =
  | "missing_summary"
  | "missing_content"
  | "missing_publisher"
  | "invalid_source_url"
  | "invalid_publish_date"
  | "missing_tags"
  | "possible_duplicate"
  | "too_short"
  | "ready_for_review"
  | "not_convertible";

export type ImportedCandidateSyncStatus = "live" | "fallback";

export type DuplicateReason =
  | "same_source_url"
  | "similar_title"
  | "same_publisher_near_date"
  | "same_repo_release_family"
  | "same_canonical_url";

export type DuplicateGroupStatus = "open" | "resolved" | "ignored";

export type SkillType =
  "engineering" | "analysis" | "product" | "operations" | "communication";

export type HeatLevel = "emerging" | "active" | "hot";

export type LearningCost = "low" | "medium" | "high";

export type KnowledgeCategory =
  | "machine-learning"
  | "software-architecture"
  | "data"
  | "product-thinking"
  | "operations";

export type DifficultyLevel = "foundation" | "intermediate" | "advanced";

export type RelationType =
  | "builds-on"
  | "uses"
  | "explains"
  | "requires"
  | "extends"
  | "supports"
  | "related-to";

export interface TopicTag {
  id: string;
  name: string;
  description: string;
}

export interface LocalizedText {
  original: string;
  zh?: string;
  en?: string;
}

export interface TechnologySourceReference {
  sourceName: string;
  sourceUrl: string;
  publisherName?: string;
  publishDate?: string;
}

export interface CandidateSourceReference extends TechnologySourceReference {
  candidateId: string;
  sourceType: ImportedSourceType;
}

export interface TechnologyItem {
  id: string;
  title: LocalizedText;
  slug: string;
  summary: LocalizedText;
  content: LocalizedText;
  type: TechnologyType;
  publishDate: string;
  sourceName: string;
  sourceUrl: string;
  sourceLanguage: SourceLanguage;
  translationStatus: TranslationStatus;
  publisherName: string;
  publisherType: PublisherType;
  importanceLevel: ImportanceLevel;
  status: TechnologyStatus;
  tags: string[];
  relatedKnowledgeIds: string[];
  relatedSkillIds: string[];
  relatedTechnologyIds?: string[];
  sourceReferences?: TechnologySourceReference[];
  priority?: TechnologyPriorityRanking;
  whyItMatters?: string;
  whoShouldCare?: string[];
  technicalContext?: string;
  impactAreas?: string[];
  learningPath?: string[];
  relatedKnowledgeExplanations?: Record<string, string>;
  relatedSkillExplanations?: Record<string, string>;
  followUpQuestions?: string[];
  readingDifficulty?: ReadingDifficulty;
  intelligenceStatus?: IntelligenceStatus;
}

export interface EditorialEnrichmentReferenceInput {
  id: string;
  title: string;
  summary?: string;
}

export interface EditorialEnrichmentSourceInputs {
  title: LocalizedText;
  summary: LocalizedText;
  contentPreview: string;
  sourceName: string;
  publisherName?: string;
  sourceLanguage: SourceLanguage;
  tags: string[];
  priorityLevel?: PriorityLevel;
  priorityReasons: string[];
  relatedKnowledge: EditorialEnrichmentReferenceInput[];
  relatedSkills: EditorialEnrichmentReferenceInput[];
  inputSignature: string;
}

export interface EditorialEnrichmentGeneratedFields {
  whyItMatters?: string;
  whoShouldCare?: string[];
  technicalContext?: string;
  impactAreas?: string[];
  learningPath?: string[];
  relatedKnowledgeExplanations?: Record<string, string>;
  relatedSkillExplanations?: Record<string, string>;
  followUpQuestions?: string[];
  readingDifficulty?: ReadingDifficulty;
}

export interface PromptVersion {
  id: string;
  name: string;
  purpose: PromptPurpose;
  version: string;
  status: PromptVersionStatus;
  template: string;
  outputSchema: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export type TechnologyComparisonGenerationMode = "mock_llm" | "llm_assisted";

export type TechnologyComparisonOutputValidationStatus =
  "valid" | "warning" | "failed";

export interface TechnologyComparisonFields {
  similarities: string[];
  differences: string[];
  whenToPreferA: string;
  whenToPreferB: string;
  sharedConsiderations?: string[];
}

// Persisted/cached record — internal shape, includes provider metadata.
// Never send this directly to a public API response; see toPublicComparisonResult.
export interface TechnologyComparisonRecord {
  id: string;
  pairKey: string;
  technologyIdA: string;
  technologyIdB: string;
  fields: TechnologyComparisonFields;
  generationMode: TechnologyComparisonGenerationMode;
  providerName?: string;
  modelName?: string;
  promptVersionId?: string;
  promptVersion?: string;
  outputValidationStatus: TechnologyComparisonOutputValidationStatus;
  outputValidationWarnings: string[];
  generationError?: string;
  createdAt: string;
  updatedAt: string;
}

// Public-safe shape returned by the API route and consumed by the client widget.
export interface TechnologyComparisonPublicResult {
  technologyIdA: string;
  technologyIdB: string;
  fields: TechnologyComparisonFields;
  disclaimer: string;
  generatedAt: string;
}

export interface EditorialEnrichmentSuggestion {
  id: string;
  technologyDraftId: string;
  status: EditorialEnrichmentSuggestionStatus;
  generatedFields: EditorialEnrichmentGeneratedFields;
  sourceInputs: EditorialEnrichmentSourceInputs;
  generationMode: EditorialEnrichmentGenerationMode;
  providerName?: string;
  modelName?: string;
  promptVersionId?: string;
  promptVersion?: string;
  outputValidationStatus?: EditorialEnrichmentOutputValidationStatus;
  outputValidationWarnings?: string[];
  confidence?: number;
  limitations?: string[];
  tokenUsage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  generationError?: string;
  createdAt: string;
  updatedAt: string;
  reviewStatus?: EditorialEnrichmentReviewStatus;
  qualityScore?: number;
  qualityLabels?: EditorialEnrichmentQualityLabel[];
  rejectionReason?: string;
  appliedFields?: Array<keyof EditorialEnrichmentGeneratedFields>;
  reviewedAt?: string;
  appliedAt?: string;
  rejectedAt?: string;
  reviewerNotes?: string;
}

export interface ImportedCandidate {
  id: string;
  sourceId?: string;
  sourceType: ImportedSourceType;
  sourceName: string;
  sourceUrl: string;
  originalTitle: string;
  originalSummary?: string;
  originalContent?: string;
  originalLanguage: SourceLanguage;
  publishDate: string;
  publisherName: string;
  normalizedType: CandidateNormalizedType;
  tags: string[];
  importStatus: CandidateImportStatus;
  duplicateGroupId?: string;
  relatedCandidateIds: string[];
  reviewedAt?: string;
  convertedTechnologyId?: string;
  importedAt?: string;
  importRunId?: string;
  rawPayload: unknown;
}

export interface ExternalSource {
  id: string;
  name: string;
  type: ExternalSourceType;
  url: string;
  enabled: boolean;
  description?: string;
  language: SourceLanguage;
  publisherName?: string;
  publisherType: PublisherType;
  defaultTags: string[];
  defaultNormalizedType: CandidateNormalizedType;
  lastFetchedAt?: string;
  lastImportStatus: ExternalSourceImportStatus;
  lastImportMessage?: string;
  lastImportCount?: number;
  lastErrorMessage?: string;
  consecutiveFailureCount?: number;
  totalImportedCount?: number;
  lastSuccessfulImportAt?: string;
  createdAt: string;
  updatedAt: string;
  maxItems?: number;
}

export interface SourceQualityMetrics {
  successRate: number;
  totalImportRuns: number;
  successfulImportRuns: number;
  failedImportRuns: number;
  totalCandidatesImported: number;
  convertedCandidateCount: number;
  rejectedCandidateCount: number;
  duplicateCandidateCount: number;
  duplicateRate: number;
  conversionRate: number;
  rejectionRate: number;
  lastSuccessfulImportAt?: string;
  consecutiveFailureCount: number;
  qualityLevel: SourceQualityLevel;
}

export interface CandidateQualitySignals {
  hasTitle: boolean;
  hasSummary: boolean;
  hasContent: boolean;
  hasSourceUrl: boolean;
  hasPublisher: boolean;
  hasValidPublishDate: boolean;
  hasTags: boolean;
  isDuplicate: boolean;
  isTooShort: boolean;
  isConvertible: boolean;
  flags: CandidateQualityFlag[];
}

export interface TechnologyPriorityRanking {
  priorityLevel: PriorityLevel;
  priorityScore: number;
  priorityReasons: string[];
  priorityWarnings: string[];
  rankingUpdatedAt: string;
  rankingSource: RankingSource;
}

export interface DailyDigest {
  id: string;
  date: string;
  status: DailyDigestStatus;
  title: string;
  summary: string;
  editorialSummary?: string;
  highPriorityTechnologyIds: string[];
  watchTechnologyIds: string[];
  manuallyAddedTechnologyIds: string[];
  excludedTechnologyIds: string[];
  pinnedTechnologyIds: string[];
  orderedTechnologyIds: string[];
  skillIds: string[];
  knowledgeIds: string[];
  sourceNames: string[];
  generatedAt: string;
  updatedAt: string;
  lastRegeneratedAt?: string;
  publishedAt?: string;
  editorialNotes: string[];
}

export type DigestReadinessSeverity = "blocking" | "warning";

export interface DigestReadinessIssue {
  code: string;
  message: string;
  severity: DigestReadinessSeverity;
}

export interface DigestPublishReadiness {
  isReady: boolean;
  blockingErrors: DigestReadinessIssue[];
  warnings: DigestReadinessIssue[];
}

export interface DeliveryChannel {
  id: string;
  name: string;
  type: DeliveryChannelType;
  enabled: boolean;
  endpointUrl: string;
  description?: string;
  format: DeliveryFormat;
  lastDeliveredAt?: string;
  lastDeliveryStatus?: DeliveryStatus;
  lastDeliveryMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryRun {
  id: string;
  digestId: string;
  digestDate: string;
  channelId: string;
  channelName: string;
  channelType: DeliveryChannelType;
  status: DeliveryStatus;
  startedAt: string;
  finishedAt?: string;
  requestPayloadPreview: string;
  responseStatus?: number;
  responseBodyPreview?: string;
  errorMessage?: string;
  retryOfDeliveryRunId?: string;
}

export interface ScheduledDelivery {
  id: string;
  name: string;
  enabled: boolean;
  digestTarget: ScheduledDeliveryDigestTarget;
  digestDate?: string;
  channelIds: string[];
  scheduleTime: string;
  timezone: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunStatus: ScheduledDeliveryRunStatus;
  lastRunMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledDeliveryRun {
  id: string;
  scheduleId: string;
  scheduleName: string;
  digestId?: string;
  digestDate?: string;
  startedAt: string;
  finishedAt?: string;
  status: ScheduledDeliveryRunStatus;
  totalChannels: number;
  successfulChannels: number;
  failedChannels: number;
  skippedChannels: number;
  deliveryLogIds: string[];
  triggerType: ScheduledDeliveryTriggerType;
  message: string;
}

export interface TaskRunnerRun {
  id: string;
  mode: TaskRunnerMode;
  startedAt: string;
  finishedAt: string;
  status: TaskRunnerStatus;
  dueScheduleCount: number;
  skippedScheduleCount: number;
  successCount: number;
  failedCount: number;
  partialCount: number;
  deliveryLogsCreated: number;
  messages: string[];
}

export interface WorkflowEvent {
  id: string;
  entityType: string;
  entityId: string;
  action: WorkflowEventAction | string;
  actorType: WorkflowEventActorType;
  actorId?: string;
  beforeSnapshot?: unknown;
  afterSnapshot?: unknown;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type ImportRunStatus = "success" | "failed" | "partial";

export interface ImportRunSourceResult {
  sourceId: string;
  sourceName: string;
  status: ExternalSourceImportStatus;
  message: string;
  candidateCount: number;
  candidatesCreated: number;
  candidatesSkipped: number;
}

export interface ImportRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  status: ImportRunStatus;
  totalSources: number;
  enabledSources: number;
  skippedSources: number;
  successfulSources: number;
  failedSources: number;
  partialSources: number;
  totalCandidatesCreated: number;
  totalCandidatesSkipped: number;
  messages: string[];
  sourceResults: ImportRunSourceResult[];
}

export interface ImportedCandidateSourceRecord {
  id: string;
  sourceType: ImportedSourceType;
  sourceName: string;
  sourceUrl: string;
  syncStatus: ImportedCandidateSyncStatus;
  itemCount: number;
  fetchedAt: string;
  note?: string;
}

export interface ImportedCandidateSnapshot {
  syncedAt: string;
  sources: ImportedCandidateSourceRecord[];
  candidates: ImportedCandidate[];
}

export interface DuplicateGroup {
  id: string;
  candidateIds: string[];
  primaryCandidateId: string;
  status: DuplicateGroupStatus;
  reasons: DuplicateReason[];
  createdAt: string;
  updatedAt: string;
}

export interface TechnologyWorkspaceRecord extends TechnologyItem {
  sourceCandidateId?: string;
  sourceReferences?: CandidateSourceReference[];
  createdAt: string;
  updatedAt: string;
  editorialNotes: string[];
}

export type TechnologyDraft = TechnologyWorkspaceRecord;

export interface SkillItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  skillType: SkillType;
  heatLevel: HeatLevel;
  learningCost: LearningCost;
  tags: string[];
  relatedTechnologyIds: string[];
  relatedKnowledgeIds: string[];
}

export interface KnowledgeItem {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: KnowledgeCategory;
  difficulty: DifficultyLevel;
  tags: string[];
  relatedTechnologyIds: string[];
  relatedSkillIds: string[];
}

export interface LinkRelation {
  id: string;
  fromId: string;
  fromType: ContentKind;
  toId: string;
  toType: ContentKind;
  relationType: RelationType;
  note: string;
}

export interface RelationListItem {
  id: string;
  title: string;
  href: string;
  relationType: RelationType;
  note: string;
}
