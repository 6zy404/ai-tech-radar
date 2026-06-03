import { getAllTechnologies } from "@/lib/content";
import { evaluateTechnologyPriority } from "@/lib/ranking";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import { tryRecordWorkflowEvent } from "@/lib/workflow-events";
import type {
  DailyDigest,
  DailyDigestStatus,
  DigestPublishReadiness,
  DigestReadinessIssue,
  PriorityLevel,
  TechnologyItem
} from "@/types/content";

interface DailyDigestStore {
  updatedAt: string;
  digests: DailyDigest[];
}

interface BuildDailyDigestOptions {
  now?: Date;
  lookbackDays?: number;
  maxHighPriorityItems?: number;
  maxWatchItems?: number;
}

interface DigestReadinessOptions {
  publishedTechnologies?: TechnologyItem[];
  allTechnologies?: TechnologyItem[];
}

export interface DailyDigestUpdateInput {
  title?: string;
  summary?: string;
  editorialSummary?: string;
  editorialNotes?: string[];
}

export type DailyDigestItemAction =
  | "exclude"
  | "include"
  | "pin"
  | "unpin"
  | "move_up"
  | "move_down";

const dailyDigestStorePath = getLocalStoreFilePath("daily-digests.json");
const defaultLookbackDays = 90;
const defaultMaxHighPriorityItems = 4;
const defaultMaxWatchItems = 6;

const priorityWeight: Record<PriorityLevel, number> = {
  high_priority: 3,
  watch: 2,
  low_priority: 1
};

export class DigestPublishReadinessError extends Error {
  readiness: DigestPublishReadiness;

  constructor(readiness: DigestPublishReadiness) {
    super("Digest is not ready to publish.");
    this.name = "DigestPublishReadinessError";
    this.readiness = readiness;
  }
}

function getTodayDateString(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultDigestTitle(date: string): string {
  return `Daily Technology Digest - ${date}`;
}

function normalizeDigestStatus(value: unknown): DailyDigestStatus {
  return value === "published" || value === "archived" || value === "draft"
    ? value
    : "draft";
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return uniqueIds(
    value
      .map((item) => String(item ?? "").trim())
      .filter((item) => item.length > 0)
  );
}

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => id.trim().length > 0)));
}

function normalizeDigest(record: Record<string, unknown>): DailyDigest {
  const date = String(record.date ?? getTodayDateString()).slice(0, 10);
  const generatedAt =
    typeof record.generatedAt === "string"
      ? record.generatedAt
      : new Date().toISOString();
  const updatedAt =
    typeof record.updatedAt === "string" ? record.updatedAt : generatedAt;

  return {
    id: typeof record.id === "string" ? record.id : `digest-${date}`,
    date,
    status: normalizeDigestStatus(record.status),
    title:
      typeof record.title === "string" && record.title.trim()
        ? record.title
        : getDefaultDigestTitle(date),
    summary:
      typeof record.summary === "string" && record.summary.trim()
        ? record.summary
        : "A daily brief generated from published technology signals.",
    editorialSummary:
      typeof record.editorialSummary === "string"
        ? record.editorialSummary
        : undefined,
    highPriorityTechnologyIds: normalizeStringArray(
      record.highPriorityTechnologyIds
    ),
    watchTechnologyIds: normalizeStringArray(record.watchTechnologyIds),
    manuallyAddedTechnologyIds: normalizeStringArray(
      record.manuallyAddedTechnologyIds
    ),
    excludedTechnologyIds: normalizeStringArray(record.excludedTechnologyIds),
    pinnedTechnologyIds: normalizeStringArray(record.pinnedTechnologyIds),
    orderedTechnologyIds: normalizeStringArray(record.orderedTechnologyIds),
    skillIds: normalizeStringArray(record.skillIds),
    knowledgeIds: normalizeStringArray(record.knowledgeIds),
    sourceNames: normalizeStringArray(record.sourceNames),
    generatedAt,
    updatedAt,
    lastRegeneratedAt:
      typeof record.lastRegeneratedAt === "string"
        ? record.lastRegeneratedAt
        : undefined,
    publishedAt:
      typeof record.publishedAt === "string" ? record.publishedAt : undefined,
    editorialNotes: normalizeStringArray(record.editorialNotes)
  };
}

function readDailyDigestStore(): DailyDigestStore {
  const store = readJsonFile<DailyDigestStore>(dailyDigestStorePath, {
    updatedAt: new Date().toISOString(),
    digests: []
  });

  return {
    updatedAt: store.updatedAt ?? new Date().toISOString(),
    digests: (store.digests ?? [])
      .map((digest) =>
        normalizeDigest(digest as unknown as Record<string, unknown>)
      )
      .sort((left, right) => right.date.localeCompare(left.date))
  };
}

function writeDailyDigestStore(store: DailyDigestStore) {
  writeJsonFile(dailyDigestStorePath, {
    updatedAt: new Date().toISOString(),
    digests: store.digests.sort((left, right) =>
      right.date.localeCompare(left.date)
    )
  });
}

function parseDateValue(value: string): number | undefined {
  const time = Date.parse(value);

  return Number.isNaN(time) ? undefined : time;
}

function getAgeInDays(dateValue: string, now: Date): number | undefined {
  const time = parseDateValue(dateValue);

  if (time === undefined) {
    return undefined;
  }

  return Math.max(0, (now.valueOf() - time) / (1000 * 60 * 60 * 24));
}

function isPublishedTechnologyEligible(
  technology: TechnologyItem,
  now: Date,
  lookbackDays: number
): boolean {
  if (technology.status !== "published") {
    return false;
  }

  const publishTime = parseDateValue(technology.publishDate);

  if (publishTime === undefined || publishTime > now.valueOf()) {
    return false;
  }

  const ageInDays = getAgeInDays(technology.publishDate, now);

  return ageInDays !== undefined && ageInDays <= lookbackDays;
}

function sortTechnologiesForDigest(
  left: TechnologyItem,
  right: TechnologyItem,
  now: Date
): number {
  const leftRanking = evaluateTechnologyPriority(left, { now });
  const rightRanking = evaluateTechnologyPriority(right, { now });
  const priorityDelta =
    priorityWeight[rightRanking.priorityLevel] -
    priorityWeight[leftRanking.priorityLevel];

  if (priorityDelta !== 0) {
    return priorityDelta;
  }

  const scoreDelta = rightRanking.priorityScore - leftRanking.priorityScore;

  if (scoreDelta !== 0) {
    return scoreDelta;
  }

  return right.publishDate.localeCompare(left.publishDate);
}

function aggregateIds(
  technologies: TechnologyItem[],
  getIds: (technology: TechnologyItem) => string[]
): string[] {
  const counts = new Map<string, number>();

  for (const technology of technologies) {
    for (const id of getIds(technology)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((left, right) => {
      const countDelta = right[1] - left[1];

      return countDelta !== 0 ? countDelta : left[0].localeCompare(right[0]);
    })
    .map(([id]) => id)
    .slice(0, 8);
}

function buildDigestSummary(
  highPriorityCount: number,
  watchCount: number,
  sourceCount: number
): string {
  if (highPriorityCount === 0 && watchCount === 0) {
    return "No recent published technology signals qualified for today's digest.";
  }

  return [
    `${highPriorityCount} item(s) need immediate attention`,
    `${watchCount} item(s) are worth tracking`,
    `${sourceCount} source(s) are represented`
  ].join(". ");
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasLocalizedText(value: TechnologyItem["title"]): boolean {
  return hasText(value.original) || hasText(value.zh) || hasText(value.en);
}

function isValidUrl(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isValidDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  return !Number.isNaN(Date.parse(value));
}

function isDigestManuallyAdjusted(digest: DailyDigest): boolean {
  return (
    hasText(digest.editorialSummary) ||
    digest.manuallyAddedTechnologyIds.length > 0 ||
    digest.excludedTechnologyIds.length > 0 ||
    digest.pinnedTechnologyIds.length > 0 ||
    digest.orderedTechnologyIds.length > 0 ||
    digest.title !== getDefaultDigestTitle(digest.date) ||
    digest.updatedAt !== digest.generatedAt
  );
}

function getAutoDigestContentIds(digest: DailyDigest): string[] {
  return uniqueIds([
    ...digest.highPriorityTechnologyIds,
    ...digest.watchTechnologyIds
  ]);
}

function getActiveDigestInputIds(digest: DailyDigest): string[] {
  const excludedIds = new Set(digest.excludedTechnologyIds);

  return [
    ...digest.highPriorityTechnologyIds,
    ...digest.watchTechnologyIds,
    ...digest.manuallyAddedTechnologyIds
  ].filter((id) => !excludedIds.has(id));
}

function findDuplicateIds(ids: string[]): string[] {
  const counts = new Map<string, number>();

  for (const id of ids) {
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id);
}

function syncDigestAggregates(
  digest: DailyDigest,
  technologies = getAllTechnologies()
): DailyDigest {
  const selectedTechnologies = getSelectedDigestTechnologies(
    digest,
    technologies
  );
  const sourceNames = Array.from(
    new Set(
      selectedTechnologies
        .map((technology) => technology.sourceName.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));

  return {
    ...digest,
    skillIds: aggregateIds(
      selectedTechnologies,
      (technology) => technology.relatedSkillIds
    ),
    knowledgeIds: aggregateIds(
      selectedTechnologies,
      (technology) => technology.relatedKnowledgeIds
    ),
    sourceNames
  };
}

function saveDigest(nextDigest: DailyDigest): DailyDigest {
  const store = readDailyDigestStore();
  const digest = normalizeDigest(nextDigest as unknown as Record<string, unknown>);

  writeDailyDigestStore({
    updatedAt: new Date().toISOString(),
    digests: [
      ...store.digests.filter((item) => item.date !== digest.date),
      digest
    ]
  });

  return digest;
}

function createReadinessIssue(
  code: string,
  message: string,
  severity: "blocking" | "warning"
): DigestReadinessIssue {
  return { code, message, severity };
}

export function buildDailyDigestFromTechnologies(
  technologies: TechnologyItem[],
  date = getTodayDateString(),
  options: BuildDailyDigestOptions = {}
): DailyDigest {
  const now = options.now ?? new Date(`${date}T12:00:00.000Z`);
  const lookbackDays = options.lookbackDays ?? defaultLookbackDays;
  const rankedTechnologies = technologies
    .filter((technology) =>
      isPublishedTechnologyEligible(technology, now, lookbackDays)
    )
    .map((technology) => ({
      technology,
      ranking: evaluateTechnologyPriority(technology, { now })
    }))
    .sort((left, right) =>
      sortTechnologiesForDigest(left.technology, right.technology, now)
    );
  const highPriorityTechnologies = rankedTechnologies
    .filter((item) => item.ranking.priorityLevel === "high_priority")
    .slice(0, options.maxHighPriorityItems ?? defaultMaxHighPriorityItems)
    .map((item) => item.technology);
  const watchTechnologies = rankedTechnologies
    .filter((item) => item.ranking.priorityLevel === "watch")
    .slice(0, options.maxWatchItems ?? defaultMaxWatchItems)
    .map((item) => item.technology);
  const selectedTechnologies = [
    ...highPriorityTechnologies,
    ...watchTechnologies
  ];
  const sourceNames = Array.from(
    new Set(
      selectedTechnologies
        .map((technology) => technology.sourceName.trim())
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
  const timestamp = now.toISOString();

  return {
    id: `digest-${date}`,
    date,
    status: "draft",
    title: getDefaultDigestTitle(date),
    summary: buildDigestSummary(
      highPriorityTechnologies.length,
      watchTechnologies.length,
      sourceNames.length
    ),
    editorialSummary: "",
    highPriorityTechnologyIds: highPriorityTechnologies.map(
      (technology) => technology.id
    ),
    watchTechnologyIds: watchTechnologies.map((technology) => technology.id),
    manuallyAddedTechnologyIds: [],
    excludedTechnologyIds: [],
    pinnedTechnologyIds: [],
    orderedTechnologyIds: selectedTechnologies.map((technology) => technology.id),
    skillIds: aggregateIds(
      selectedTechnologies,
      (technology) => technology.relatedSkillIds
    ),
    knowledgeIds: aggregateIds(
      selectedTechnologies,
      (technology) => technology.relatedKnowledgeIds
    ),
    sourceNames,
    generatedAt: timestamp,
    updatedAt: timestamp,
    editorialNotes: [
      "Generated from published TechnologyItem records using Ranking v0 priority levels.",
      "Low-priority items are excluded by default in Daily Digest v0."
    ]
  };
}

export function generateDailyDigest(date = getTodayDateString()): DailyDigest {
  const regeneratedAt = new Date().toISOString();
  const nextDigest = buildDailyDigestFromTechnologies(getAllTechnologies(), date);
  const store = readDailyDigestStore();
  const existingDigest = store.digests.find((digest) => digest.date === date);
  const preserveManualAdjustments =
    existingDigest && isDigestManuallyAdjusted(existingDigest);
  const mergedDigest: DailyDigest = syncDigestAggregates({
    ...nextDigest,
    status: existingDigest?.status ?? "draft",
    title: preserveManualAdjustments ? existingDigest.title : nextDigest.title,
    summary: preserveManualAdjustments
      ? existingDigest.summary
      : nextDigest.summary,
    editorialSummary: preserveManualAdjustments
      ? existingDigest.editorialSummary
      : nextDigest.editorialSummary,
    manuallyAddedTechnologyIds:
      existingDigest?.manuallyAddedTechnologyIds ?? [],
    excludedTechnologyIds: existingDigest?.excludedTechnologyIds ?? [],
    pinnedTechnologyIds: existingDigest?.pinnedTechnologyIds ?? [],
    orderedTechnologyIds: preserveManualAdjustments
      ? uniqueIds([
          ...(existingDigest?.orderedTechnologyIds ?? []),
          ...nextDigest.orderedTechnologyIds
        ])
      : nextDigest.orderedTechnologyIds,
    publishedAt: existingDigest?.publishedAt,
    editorialNotes: preserveManualAdjustments
      ? existingDigest.editorialNotes
      : nextDigest.editorialNotes,
    lastRegeneratedAt: existingDigest ? regeneratedAt : undefined,
    updatedAt: regeneratedAt
  });

  writeDailyDigestStore({
    updatedAt: regeneratedAt,
    digests: [
      ...store.digests.filter((item) => item.date !== date),
      mergedDigest
    ]
  });

  tryRecordWorkflowEvent({
    entityType: "daily_digest",
    entityId: mergedDigest.id,
    action: "digest.generated",
    actorType: "workspace_user",
    beforeSnapshot: existingDigest,
    afterSnapshot: mergedDigest,
    metadata: {
      date,
      preserveManualAdjustments: Boolean(preserveManualAdjustments)
    }
  });

  return mergedDigest;
}

export function getDailyDigests(): DailyDigest[] {
  return readDailyDigestStore().digests;
}

export function getDailyDigestByDate(date: string): DailyDigest | undefined {
  return getDailyDigests().find((digest) => digest.date === date);
}

export function getPublishedDailyDigestByDate(
  date: string
): DailyDigest | undefined {
  const digest = getDailyDigestByDate(date);

  return digest?.status === "published" ? digest : undefined;
}

export function getLatestPublishedDailyDigest(): DailyDigest | undefined {
  return getDailyDigests()
    .filter((digest) => digest.status === "published")
    .sort((left, right) => right.date.localeCompare(left.date))[0];
}

export function getTodayDigestPreview(): DailyDigest {
  return buildDailyDigestFromTechnologies(
    getAllTechnologies(),
    getTodayDateString()
  );
}

export function getSelectedDigestTechnologyIds(digest: DailyDigest): string[] {
  const selectedIds = uniqueIds(getActiveDigestInputIds(digest));
  const selectedSet = new Set(selectedIds);
  const orderedIds = [
    ...digest.orderedTechnologyIds.filter((id) => selectedSet.has(id)),
    ...selectedIds.filter((id) => !digest.orderedTechnologyIds.includes(id))
  ];
  const pinnedIds = digest.pinnedTechnologyIds.filter((id) =>
    selectedSet.has(id)
  );

  return uniqueIds([
    ...pinnedIds,
    ...orderedIds.filter((id) => !pinnedIds.includes(id))
  ]);
}

export function getSelectedDigestTechnologies(
  digest: DailyDigest,
  technologies = getAllTechnologies()
): TechnologyItem[] {
  const technologyById = new Map(
    technologies.map((technology) => [technology.id, technology])
  );

  return getSelectedDigestTechnologyIds(digest)
    .map((id) => technologyById.get(id))
    .filter((technology): technology is TechnologyItem => Boolean(technology));
}

export function getDigestTechnologySections(
  digest: DailyDigest,
  technologies = getAllTechnologies()
): {
  highPriorityTechnologies: TechnologyItem[];
  watchTechnologies: TechnologyItem[];
} {
  const selectedTechnologies = getSelectedDigestTechnologies(
    digest,
    technologies
  );
  const highPriorityIdSet = new Set(digest.highPriorityTechnologyIds);
  const pinnedIdSet = new Set(digest.pinnedTechnologyIds);
  const highPriorityTechnologies: TechnologyItem[] = [];
  const watchTechnologies: TechnologyItem[] = [];

  for (const technology of selectedTechnologies) {
    const ranking = evaluateTechnologyPriority(technology);

    if (
      pinnedIdSet.has(technology.id) ||
      highPriorityIdSet.has(technology.id) ||
      ranking.priorityLevel === "high_priority"
    ) {
      highPriorityTechnologies.push(technology);
    } else {
      watchTechnologies.push(technology);
    }
  }

  return {
    highPriorityTechnologies,
    watchTechnologies
  };
}

export function updateDailyDigest(
  date: string,
  updates: DailyDigestUpdateInput
): DailyDigest {
  const existingDigest = getDailyDigestByDate(date);

  if (!existingDigest) {
    throw new Error(`Daily digest ${date} not found.`);
  }

  const nextDigest = syncDigestAggregates({
    ...existingDigest,
    title: updates.title ?? existingDigest.title,
    summary: updates.summary ?? existingDigest.summary,
    editorialSummary:
      updates.editorialSummary ?? existingDigest.editorialSummary,
    editorialNotes: updates.editorialNotes ?? existingDigest.editorialNotes,
    updatedAt: new Date().toISOString()
  });

  const savedDigest = saveDigest(nextDigest);

  tryRecordWorkflowEvent({
    entityType: "daily_digest",
    entityId: savedDigest.id,
    action: "digest.updated",
    actorType: "workspace_user",
    beforeSnapshot: existingDigest,
    afterSnapshot: savedDigest,
    metadata: {
      date
    }
  });

  return savedDigest;
}

export function updateDailyDigestItemControl(
  date: string,
  technologyId: string,
  action: DailyDigestItemAction
): DailyDigest {
  const existingDigest = getDailyDigestByDate(date);

  if (!existingDigest) {
    throw new Error(`Daily digest ${date} not found.`);
  }

  if (!getAllTechnologies().some((technology) => technology.id === technologyId)) {
    throw new Error(`Technology ${technologyId} is not available for digest use.`);
  }

  const nextDigest: DailyDigest = {
    ...existingDigest,
    updatedAt: new Date().toISOString()
  };

  if (action === "include") {
    nextDigest.manuallyAddedTechnologyIds = uniqueIds([
      ...nextDigest.manuallyAddedTechnologyIds,
      technologyId
    ]);
    nextDigest.excludedTechnologyIds = nextDigest.excludedTechnologyIds.filter(
      (id) => id !== technologyId
    );
    nextDigest.orderedTechnologyIds = uniqueIds([
      ...nextDigest.orderedTechnologyIds,
      technologyId
    ]);
  }

  if (action === "exclude") {
    nextDigest.excludedTechnologyIds = uniqueIds([
      ...nextDigest.excludedTechnologyIds,
      technologyId
    ]);
    nextDigest.manuallyAddedTechnologyIds =
      nextDigest.manuallyAddedTechnologyIds.filter((id) => id !== technologyId);
    nextDigest.pinnedTechnologyIds = nextDigest.pinnedTechnologyIds.filter(
      (id) => id !== technologyId
    );
    nextDigest.orderedTechnologyIds = nextDigest.orderedTechnologyIds.filter(
      (id) => id !== technologyId
    );
  }

  if (action === "pin") {
    nextDigest.pinnedTechnologyIds = uniqueIds([
      technologyId,
      ...nextDigest.pinnedTechnologyIds
    ]);
  }

  if (action === "unpin") {
    nextDigest.pinnedTechnologyIds = nextDigest.pinnedTechnologyIds.filter(
      (id) => id !== technologyId
    );
  }

  if (action === "move_up" || action === "move_down") {
    const selectedIds = getSelectedDigestTechnologyIds(nextDigest);
    const index = selectedIds.indexOf(technologyId);
    const targetIndex = action === "move_up" ? index - 1 : index + 1;

    if (index >= 0 && targetIndex >= 0 && targetIndex < selectedIds.length) {
      const reorderedIds = [...selectedIds];
      const [item] = reorderedIds.splice(index, 1);

      reorderedIds.splice(targetIndex, 0, item);
      nextDigest.orderedTechnologyIds = reorderedIds;
    }
  }

  const savedDigest = saveDigest(syncDigestAggregates(nextDigest));

  tryRecordWorkflowEvent({
    entityType: "daily_digest",
    entityId: savedDigest.id,
    action: "digest.updated",
    actorType: "workspace_user",
    beforeSnapshot: existingDigest,
    afterSnapshot: savedDigest,
    metadata: {
      date,
      technologyId,
      action
    }
  });

  return savedDigest;
}

export function evaluateDailyDigestPublishReadiness(
  digest: DailyDigest,
  options: DigestReadinessOptions = {}
): DigestPublishReadiness {
  const publishedTechnologies = options.publishedTechnologies ?? getAllTechnologies();
  const allTechnologies = options.allTechnologies ?? publishedTechnologies;
  const allTechnologyById = new Map(
    allTechnologies.map((technology) => [technology.id, technology])
  );
  const publishedTechnologyById = new Map(
    publishedTechnologies
      .filter((technology) => technology.status === "published")
      .map((technology) => [technology.id, technology])
  );
  const selectedIds = getSelectedDigestTechnologyIds(digest);
  const duplicateInputIds = findDuplicateIds(getActiveDigestInputIds(digest));
  const blockingErrors: DigestReadinessIssue[] = [];
  const warnings: DigestReadinessIssue[] = [];

  if (!hasText(digest.title)) {
    blockingErrors.push(
      createReadinessIssue(
        "missing_title",
        "Digest title is required before publication.",
        "blocking"
      )
    );
  }

  if (!isValidDate(digest.date)) {
    blockingErrors.push(
      createReadinessIssue(
        "invalid_date",
        "Digest date is missing or invalid.",
        "blocking"
      )
    );
  }

  if (selectedIds.length === 0) {
    blockingErrors.push(
      createReadinessIssue(
        "empty_digest",
        "At least one immediate-attention or watch item is required.",
        "blocking"
      )
    );
  }

  if (duplicateInputIds.length > 0) {
    blockingErrors.push(
      createReadinessIssue(
        "duplicate_technology",
        `Digest references duplicate technology item(s): ${duplicateInputIds.join(", ")}.`,
        "blocking"
      )
    );
  }

  for (const id of selectedIds) {
    const knownTechnology = allTechnologyById.get(id);
    const publishedTechnology = publishedTechnologyById.get(id);

    if (!knownTechnology) {
      blockingErrors.push(
        createReadinessIssue(
          "missing_technology",
          `Digest references unknown TechnologyItem ${id}.`,
          "blocking"
        )
      );
      continue;
    }

    if (!publishedTechnology) {
      blockingErrors.push(
        createReadinessIssue(
          "unpublished_technology",
          `Digest references TechnologyItem ${id}, but it is not published.`,
          "blocking"
        )
      );
      continue;
    }

    if (
      !hasLocalizedText(publishedTechnology.title) ||
      !hasLocalizedText(publishedTechnology.summary) ||
      !hasText(publishedTechnology.slug) ||
      !hasText(publishedTechnology.sourceName) ||
      !isValidUrl(publishedTechnology.sourceUrl) ||
      !isValidDate(publishedTechnology.publishDate)
    ) {
      blockingErrors.push(
        createReadinessIssue(
          "incomplete_user_facing_item",
          `TechnologyItem ${id} is missing required user-facing digest fields.`,
          "blocking"
        )
      );
    }
  }

  const { highPriorityTechnologies, watchTechnologies } =
    getDigestTechnologySections(digest, publishedTechnologies);

  if (highPriorityTechnologies.length === 0) {
    warnings.push(
      createReadinessIssue(
        "no_high_priority_items",
        "No immediate-attention items are selected.",
        "warning"
      )
    );
  }

  if (digest.skillIds.length === 0) {
    warnings.push(
      createReadinessIssue(
        "no_related_skills",
        "No related skills are aggregated for this digest.",
        "warning"
      )
    );
  }

  if (digest.knowledgeIds.length === 0) {
    warnings.push(
      createReadinessIssue(
        "no_related_knowledge",
        "No related knowledge items are aggregated for this digest.",
        "warning"
      )
    );
  }

  if (!hasText(digest.editorialSummary)) {
    warnings.push(
      createReadinessIssue(
        "missing_editorial_summary",
        "Editorial summary is empty.",
        "warning"
      )
    );
  }

  if (digest.sourceNames.length === 0) {
    warnings.push(
      createReadinessIssue(
        "no_sources",
        "No source names are aggregated for this digest.",
        "warning"
      )
    );
  }

  if (watchTechnologies.length === 0 || watchTechnologies.length > 6) {
    warnings.push(
      createReadinessIssue(
        "watch_count_out_of_range",
        "Watch section count is unusually low or high.",
        "warning"
      )
    );
  }

  return {
    isReady: blockingErrors.length === 0,
    blockingErrors,
    warnings
  };
}

export function publishDailyDigest(date: string): DailyDigest {
  const existingDigest =
    getDailyDigestByDate(date) ??
    buildDailyDigestFromTechnologies(getAllTechnologies(), date);
  const digest = syncDigestAggregates(existingDigest);
  const readiness = evaluateDailyDigestPublishReadiness(digest);

  if (!readiness.isReady) {
    tryRecordWorkflowEvent({
      entityType: "daily_digest",
      entityId: digest.id,
      action: "digest.publish_failed",
      actorType: "workspace_user",
      beforeSnapshot: digest,
      metadata: {
        date,
        blockingErrors: readiness.blockingErrors.map((issue) => issue.code)
      }
    });
    throw new DigestPublishReadinessError(readiness);
  }

  const publishedDigest = saveDigest({
    ...digest,
    status: "published",
    publishedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  tryRecordWorkflowEvent({
    entityType: "daily_digest",
    entityId: publishedDigest.id,
    action: "digest.published",
    actorType: "workspace_user",
    beforeSnapshot: digest,
    afterSnapshot: publishedDigest,
    metadata: {
      date
    }
  });

  return publishedDigest;
}

export function updateDailyDigestStatus(
  date: string,
  status: DailyDigestStatus
): DailyDigest {
  if (status === "published") {
    return publishDailyDigest(date);
  }

  const existingDigest = getDailyDigestByDate(date);

  if (!existingDigest) {
    throw new Error(`Daily digest ${date} not found.`);
  }

  const savedDigest = saveDigest({
    ...existingDigest,
    status,
    publishedAt: status === "draft" ? undefined : existingDigest.publishedAt,
    updatedAt: new Date().toISOString()
  });

  tryRecordWorkflowEvent({
    entityType: "daily_digest",
    entityId: savedDigest.id,
    action: "digest.updated",
    actorType: "workspace_user",
    beforeSnapshot: existingDigest,
    afterSnapshot: savedDigest,
    metadata: {
      date,
      status
    }
  });

  return savedDigest;
}

export { getTodayDateString };
