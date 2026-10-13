/**
 * 问雷达追问: the rules for carrying a conversation across requests. Pure and
 * client-safe — the page imports the limits, the route parses with them.
 *
 * The server stays stateless. The browser keeps the conversation (in memory
 * only: a reload starts a new one) and sends, with every follow-up, the
 * earlier questions and answers plus the reference numbers it has already
 * shown (`{ ref, key }`). The server re-resolves each key against published
 * content before the model sees it, so a client cannot smuggle a title, a
 * link or an unpublished item into the conversation — at most it can name a
 * published item by its key, which the search tool could return anyway.
 *
 * Reference numbers never restart within a conversation: an item already
 * shown keeps its number, and anything retrieved by a follow-up is numbered
 * after the highest one the conversation has used. A follow-up may cite an
 * earlier item (the page can still link it); a number neither this round nor
 * an earlier one retrieved is invalid, as before.
 */

/** Questions in one conversation, the first included. */
export const askMaxTurns = 5;

/** Same bound as a first question (the route's own limit). */
export const askHistoryQuestionMaxChars = 200;

/**
 * An earlier answer is context for what a follow-up refers to, never a
 * source, so it is cut: the model needs its gist and its reference numbers,
 * not every sentence. Answers are told to stay under 300 characters, so this
 * cuts only the rare long one.
 */
export const askHistoryAnswerMaxChars = 600;

/**
 * Total characters of earlier turns sent to the model. With four earlier
 * turns at the per-turn caps this is the binding limit: the oldest turns are
 * dropped first. About 2,000 extra prompt tokens per model round at most —
 * every round of the tool loop re-sends the history, so this bounds the
 * cost of a long conversation at roughly twice a first question's.
 */
export const askHistoryMaxChars = 2400;

/** Reference numbers a conversation can carry forward. */
export const askMaxPriorSources = 40;

const sourceKeyPattern = /^[TSK]:[a-z0-9][a-z0-9-]{0,119}$/i;
const maxRef = 999;

export interface AskHistoryTurn {
  question: string;
  answer: string;
}

export interface AskPriorSourceRef {
  ref: number;
  key: string;
}

export interface AskConversationInput {
  question: string;
  history: AskHistoryTurn[];
  priorSources: AskPriorSourceRef[];
}

export type ParsedAskRequest =
  | ({ ok: true } & AskConversationInput)
  | { ok: false; error: string };

const minQuestionLength = 2;

/**
 * Cuts text to `limit` characters, at the last sentence end inside the limit
 * when there is one past the halfway point, and marks the cut with 「…」.
 */
export function truncateForHistory(text: string, limit: number): string {
  const trimmed = text.trim();

  if (trimmed.length <= limit) {
    return trimmed;
  }

  const head = trimmed.slice(0, limit - 1);
  const lastStop = Math.max(
    head.lastIndexOf("。"),
    head.lastIndexOf("！"),
    head.lastIndexOf("？"),
    head.lastIndexOf("\n")
  );
  const cut = lastStop >= limit / 2 ? head.slice(0, lastStop + 1) : head;

  return `${cut.trimEnd()}…`;
}

/**
 * Keeps the most recent turns that fit in `askHistoryMaxChars`, oldest
 * dropped first, each turn already cut to its own caps. Order is preserved.
 */
export function fitHistory(turns: AskHistoryTurn[]): AskHistoryTurn[] {
  const cut = turns.map((turn) => ({
    question: truncateForHistory(turn.question, askHistoryQuestionMaxChars),
    answer: truncateForHistory(turn.answer, askHistoryAnswerMaxChars)
  }));
  const kept: AskHistoryTurn[] = [];
  let total = 0;

  for (let index = cut.length - 1; index >= 0; index -= 1) {
    const size = cut[index].question.length + cut[index].answer.length;

    if (total + size > askHistoryMaxChars) {
      break;
    }

    kept.unshift(cut[index]);
    total += size;
  }

  return kept;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * Validates a POST /api/ask body. A first question is `{ question }`; a
 * follow-up adds `history` and `sources`. Malformed history is an error (a
 * page bug, not something to guess around); a turn past the limit is an
 * error with a message the page can show as is.
 */
export function parseAskRequest(body: unknown): ParsedAskRequest {
  const record = asRecord(body);
  const question =
    typeof record?.question === "string" ? record.question.trim() : "";

  if (
    question.length < minQuestionLength ||
    question.length > askHistoryQuestionMaxChars
  ) {
    return {
      ok: false,
      error: `问题需要 ${minQuestionLength} 到 ${askHistoryQuestionMaxChars} 个字。`
    };
  }

  const rawHistory = record?.history ?? [];

  if (!Array.isArray(rawHistory)) {
    return { ok: false, error: "对话记录格式不对，请开新对话。" };
  }

  if (rawHistory.length >= askMaxTurns) {
    return {
      ok: false,
      error: `一段对话最多问 ${askMaxTurns} 次，请开新对话继续。`
    };
  }

  const history: AskHistoryTurn[] = [];

  for (const entry of rawHistory) {
    const turn = asRecord(entry);

    if (typeof turn?.question !== "string" || typeof turn.answer !== "string") {
      return { ok: false, error: "对话记录格式不对，请开新对话。" };
    }

    if (turn.question.trim() && turn.answer.trim()) {
      history.push({ question: turn.question, answer: turn.answer });
    }
  }

  const rawSources = record?.sources ?? [];

  if (!Array.isArray(rawSources)) {
    return { ok: false, error: "对话记录格式不对，请开新对话。" };
  }

  const priorSources: AskPriorSourceRef[] = [];
  const seenRefs = new Set<number>();
  const seenKeys = new Set<string>();

  for (const entry of rawSources.slice(0, askMaxPriorSources)) {
    const source = asRecord(entry);
    const ref = source?.ref;
    const key = source?.key;

    if (
      typeof ref !== "number" ||
      !Number.isInteger(ref) ||
      ref < 1 ||
      ref > maxRef ||
      typeof key !== "string" ||
      !sourceKeyPattern.test(key) ||
      seenRefs.has(ref) ||
      seenKeys.has(key)
    ) {
      continue;
    }

    seenRefs.add(ref);
    seenKeys.add(key);
    priorSources.push({ ref, key });
  }

  return {
    ok: true,
    question,
    history: fitHistory(history),
    priorSources: history.length > 0 ? priorSources : []
  };
}
