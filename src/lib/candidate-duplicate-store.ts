import {
  buildStableDuplicateGroupId,
  chooseDefaultPrimaryCandidate,
  dedupeDuplicateReasons,
  getDuplicateReasons,
  getPairKey
} from "@/lib/candidate-duplicate-rules";
import {
  getLocalStoreFilePath,
  readLocalJsonFile as readJsonFile,
  writeLocalJsonFile as writeJsonFile
} from "@/lib/repositories/local-json-store";
import type {
  DuplicateGroup,
  DuplicateReason,
  ImportedCandidate
} from "@/types/content";

export interface DuplicateGroupStore {
  updatedAt: string;
  groups: DuplicateGroup[];
}

export interface DuplicateAnalysis {
  candidates: ImportedCandidate[];
  pairReasons: Record<string, DuplicateReason[]>;
  /** Cosine similarity for pairs linked by `semantic_similar`, by pair key. */
  pairSemanticScores: Record<string, number>;
  groups: DuplicateGroup[];
}

export interface DuplicateAnalysisOptions {
  /**
   * Pairs the embedding model found alike (`semantic-dedup-store.ts`). They
   * link candidates exactly like a deterministic reason does. Absent when the
   * model has not run — the groups are then the deterministic ones alone.
   */
  semanticPairs?: { leftId: string; rightId: string; score: number }[];
}

const duplicateGroupStorePath = getLocalStoreFilePath("duplicate-groups.json");

export function readDuplicateGroupStore(): DuplicateGroupStore {
  const store = readJsonFile<DuplicateGroupStore>(duplicateGroupStorePath, {
    updatedAt: new Date().toISOString(),
    groups: []
  });

  return {
    updatedAt: store.updatedAt ?? new Date().toISOString(),
    groups: (store.groups ?? []).map((group) => ({
      id: group.id,
      candidateIds: [...group.candidateIds],
      primaryCandidateId: group.primaryCandidateId,
      status: group.status ?? "open",
      reasons: [...group.reasons],
      createdAt: group.createdAt ?? new Date().toISOString(),
      updatedAt: group.updatedAt ?? new Date().toISOString()
    }))
  };
}

export function writeDuplicateGroupStore(store: DuplicateGroupStore) {
  writeJsonFile(duplicateGroupStorePath, {
    updatedAt: new Date().toISOString(),
    groups: store.groups
  });
}

export function analyzeDuplicates(
  candidates: ImportedCandidate[],
  options: DuplicateAnalysisOptions = {}
): DuplicateAnalysis {
  const adjacency = new Map<string, Set<string>>();
  const pairReasons: Record<string, DuplicateReason[]> = {};
  const pairSemanticScores: Record<string, number> = {};
  const groups: DuplicateGroup[] = [];
  const persistedGroups = readDuplicateGroupStore().groups;
  const persistedGroupById = new Map(
    persistedGroups.map((group) => [group.id, group])
  );
  const now = new Date().toISOString();

  for (const candidate of candidates) {
    adjacency.set(candidate.id, new Set());
  }

  for (let index = 0; index < candidates.length; index += 1) {
    for (
      let nextIndex = index + 1;
      nextIndex < candidates.length;
      nextIndex += 1
    ) {
      const left = candidates[index];
      const right = candidates[nextIndex];
      const reasons = getDuplicateReasons(left, right);

      if (reasons.length === 0) {
        continue;
      }

      adjacency.get(left.id)?.add(right.id);
      adjacency.get(right.id)?.add(left.id);
      pairReasons[getPairKey(left.id, right.id)] = reasons;
    }
  }

  for (const pair of options.semanticPairs ?? []) {
    // A pair about a candidate that has left the snapshot window links nothing.
    if (!adjacency.has(pair.leftId) || !adjacency.has(pair.rightId)) {
      continue;
    }

    const pairKey = getPairKey(pair.leftId, pair.rightId);

    adjacency.get(pair.leftId)?.add(pair.rightId);
    adjacency.get(pair.rightId)?.add(pair.leftId);
    pairReasons[pairKey] = dedupeDuplicateReasons([
      ...(pairReasons[pairKey] ?? []),
      "semantic_similar"
    ]);
    pairSemanticScores[pairKey] = pair.score;
  }

  const visited = new Set<string>();
  const candidateMap = new Map(
    candidates.map((candidate) => [candidate.id, candidate])
  );

  for (const candidate of candidates) {
    if (visited.has(candidate.id)) {
      continue;
    }

    const stack = [candidate.id];
    const connectedIds: string[] = [];

    while (stack.length > 0) {
      const currentId = stack.pop();

      if (!currentId || visited.has(currentId)) {
        continue;
      }

      visited.add(currentId);
      connectedIds.push(currentId);

      for (const linkedId of adjacency.get(currentId) ?? []) {
        if (!visited.has(linkedId)) {
          stack.push(linkedId);
        }
      }
    }

    if (connectedIds.length <= 1) {
      continue;
    }

    const sortedConnectedIds = connectedIds.slice().sort();
    const duplicateGroupId = buildStableDuplicateGroupId(sortedConnectedIds);
    const connectedCandidates = sortedConnectedIds
      .map((id) => candidateMap.get(id))
      .filter((item): item is ImportedCandidate => Boolean(item));
    const reasons = dedupeDuplicateReasons(
      sortedConnectedIds.flatMap((leftId, leftIndex) =>
        sortedConnectedIds
          .slice(leftIndex + 1)
          .flatMap((rightId) => pairReasons[getPairKey(leftId, rightId)] ?? [])
      )
    );
    const persistedGroup = persistedGroupById.get(duplicateGroupId);
    const primaryCandidateId =
      persistedGroup &&
      sortedConnectedIds.includes(persistedGroup.primaryCandidateId)
        ? persistedGroup.primaryCandidateId
        : chooseDefaultPrimaryCandidate(connectedCandidates);
    const group: DuplicateGroup = {
      id: duplicateGroupId,
      candidateIds: sortedConnectedIds,
      primaryCandidateId,
      status: persistedGroup?.status ?? "open",
      reasons,
      createdAt: persistedGroup?.createdAt ?? now,
      updatedAt: persistedGroup?.updatedAt ?? now
    };

    groups.push(group);

    for (const connectedId of sortedConnectedIds) {
      const connectedCandidate = candidateMap.get(connectedId);

      if (!connectedCandidate) {
        continue;
      }

      connectedCandidate.duplicateGroupId = duplicateGroupId;
      connectedCandidate.relatedCandidateIds = connectedIds.filter(
        (id) => id !== connectedId
      );
    }
  }

  return { candidates, pairReasons, pairSemanticScores, groups };
}
