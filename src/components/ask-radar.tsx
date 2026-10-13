"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";

import { aiGeneratedDisclaimer } from "@/lib/ai-disclaimer";
import {
  askSourceKindLabels as kindLabels,
  buildAskConversationCopyText,
  toAnswerParagraphs
} from "@/lib/ask-answer-copy";
import { askMaxTurns } from "@/lib/ask-conversation";
import type { AskEvent, AskSource } from "@/lib/ask-radar";
import { splitAnswerWithCitations } from "@/lib/ask-radar-citations";

/**
 * One question and its answer. `sources` is the conversation's whole list as
 * of this turn: numbers never restart, so a turn starts from the previous
 * turn's list and the server sends the merged list back.
 */
interface AskTurn {
  question: string;
  statuses: string[];
  sources: AskSource[];
  answer: string;
  done: boolean;
  cited: number[];
  invalid: number[];
  error: string;
}

function newTurn(question: string, sources: AskSource[]): AskTurn {
  return {
    question,
    statuses: [],
    sources,
    answer: "",
    done: false,
    cited: [],
    invalid: [],
    error: ""
  };
}

function applyEvent(turn: AskTurn, event: AskEvent): AskTurn {
  switch (event.type) {
    case "status":
      return { ...turn, statuses: [...turn.statuses, event.text] };
    case "sources":
      return { ...turn, sources: event.sources };
    case "delta":
      return { ...turn, answer: turn.answer + event.text };
    case "reset":
      return { ...turn, answer: "" };
    case "done":
      return {
        ...turn,
        done: true,
        cited: event.cited,
        invalid: event.invalid
      };
    case "error":
      return { ...turn, done: true, error: event.message };
  }
}

function updateLast(turns: AskTurn[], update: (turn: AskTurn) => AskTurn) {
  return turns.length === 0
    ? turns
    : [...turns.slice(0, -1), update(turns[turns.length - 1])];
}

function isComplete(turn: AskTurn): boolean {
  return turn.done && !turn.error && turn.answer.trim().length > 0;
}

function AnswerText({
  text,
  sources,
  invalid
}: {
  text: string;
  sources: AskSource[];
  invalid: number[];
}) {
  const byRef = new Map(sources.map((source) => [source.ref, source]));
  const paragraphs = toAnswerParagraphs(text);

  return (
    <div className="ask-radar__answer-text">
      {paragraphs.map((paragraph, paragraphIndex) => (
        <p key={paragraphIndex}>
          {splitAnswerWithCitations(paragraph).map((part, index) => {
            if (part.type === "text") {
              return <span key={index}>{part.value}</span>;
            }

            const source = byRef.get(part.ref);

            if (!source || invalid.includes(part.ref)) {
              return (
                <span
                  key={index}
                  className="ask-radar__cite ask-radar__cite--invalid"
                  title="这个编号不对应任何检索到的条目"
                >
                  [{part.ref}?]
                </span>
              );
            }

            return (
              <Link
                key={index}
                className="ask-radar__cite"
                href={source.href}
                title={source.title}
              >
                [{part.ref}]
              </Link>
            );
          })}
        </p>
      ))}
    </div>
  );
}

function SourceList({ sources }: { sources: AskSource[] }) {
  return (
    <ol className="ask-radar__sources">
      {sources.map((source) => (
        <li key={source.ref}>
          <span className="ask-radar__source-ref">[{source.ref}]</span>
          <span className="ask-radar__source-kind">
            {kindLabels[source.kind]}
          </span>
          <Link href={source.href}>{source.title}</Link>
        </li>
      ))}
    </ol>
  );
}

function TurnView({
  turn,
  index,
  previousRefs,
  running
}: {
  turn: AskTurn;
  index: number;
  /** Numbers earlier turns already listed; not repeated under 检索到但没有引用. */
  previousRefs: ReadonlySet<number>;
  running: boolean;
}) {
  const citedSources = turn.sources.filter((source) =>
    turn.cited.includes(source.ref)
  );
  const uncitedNewSources = turn.sources.filter(
    (source) =>
      !turn.cited.includes(source.ref) && !previousRefs.has(source.ref)
  );

  return (
    <article className="ask-radar__turn">
      <h2 className="ask-radar__question">
        <span className="ask-radar__question-label">
          {index === 0 ? "问" : `追问 ${index}`}
        </span>
        <span className="ask-radar__question-text">{turn.question}</span>
      </h2>

      {turn.statuses.length > 0 ? (
        <ul className="ask-radar__statuses">
          {turn.statuses.map((status, statusIndex) => (
            <li key={statusIndex}>{status}</li>
          ))}
        </ul>
      ) : null}

      {turn.answer ? (
        <AnswerText
          text={turn.answer}
          sources={turn.sources}
          invalid={turn.invalid}
        />
      ) : running && !turn.done ? (
        <p className="ask-radar__pending">正在查找站内内容…</p>
      ) : null}

      {turn.error ? <p className="ask-radar__error">{turn.error}</p> : null}

      {turn.done && citedSources.length > 0 ? (
        <div className="ask-radar__block">
          <h3>引用</h3>
          <SourceList sources={citedSources} />
        </div>
      ) : null}

      {turn.done && uncitedNewSources.length > 0 ? (
        <details className="ask-radar__block">
          <summary>检索到但没有引用（{uncitedNewSources.length}）</summary>
          <SourceList sources={uncitedNewSources} />
        </details>
      ) : null}
    </article>
  );
}

/**
 * 复制答案 / 复制整段对话: formats what is already on the page — no request,
 * no model call. Clipboard first; when the browser refuses it, the text
 * appears in a read-only box, selected, to copy by hand (a prompt() would
 * flatten the line breaks). Keyed per turn count, so a new answer starts it
 * fresh.
 */
function CopyConversation({ turns }: { turns: AskTurn[] }) {
  const [message, setMessage] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);
  const whole = turns.length > 1;

  useEffect(() => {
    if (fallbackText) {
      fallbackRef.current?.focus();
      fallbackRef.current?.select();
    }
  }, [fallbackText]);

  async function handleCopy() {
    const text = buildAskConversationCopyText({
      turns,
      origin: window.location.origin,
      disclaimer: aiGeneratedDisclaimer
    });

    try {
      await navigator.clipboard.writeText(text);
      setFallbackText("");
      setMessage(
        whole
          ? `已复制：${turns.length} 轮问答、出处链接和免责声明。`
          : "已复制：问题、答案、出处链接和免责声明。"
      );
    } catch {
      setFallbackText(text);
      setMessage(
        "浏览器没有允许写入剪贴板。内容已在下面的文本框里选中，按 Ctrl+C（Mac 上 ⌘C）复制。"
      );
    }
  }

  return (
    <>
      <button
        type="button"
        className="ask-radar__copy-button"
        onClick={() => void handleCopy()}
      >
        {whole ? "复制整段对话" : "复制答案"}
      </button>
      <p className="ask-radar__copy-status" role="status">
        {message}
      </p>
      {fallbackText ? (
        <textarea
          ref={fallbackRef}
          className="ask-radar__copy-fallback"
          readOnly
          value={fallbackText}
          rows={Math.min(12, fallbackText.split("\n").length)}
          aria-label={whole ? "整段对话，选中后复制" : "答案全文，选中后复制"}
          onFocus={(event) => event.currentTarget.select()}
        />
      ) : null}
    </>
  );
}

function QuestionForm({
  value,
  onChange,
  onSubmit,
  running,
  label,
  placeholder,
  submitLabel,
  inputRef,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  running: boolean;
  label: string;
  placeholder: string;
  submitLabel: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  return (
    <form
      className={className ? `search-form ${className}` : "search-form"}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className="dossier-search">
        <input
          ref={inputRef}
          type="search"
          name="question"
          value={value}
          maxLength={200}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
        />
      </div>
      <button
        type="submit"
        className="action-button action-button--primary"
        disabled={running || value.trim().length < 2}
      >
        {running ? "回答中…" : submitLabel}
      </button>
    </form>
  );
}

export function AskRadar({
  examples,
  initialQuestion = ""
}: {
  examples: string[];
  initialQuestion?: string;
}) {
  const [input, setInput] = useState(initialQuestion);
  const [followUp, setFollowUp] = useState("");
  // The conversation lives in this component only: a reload, or 开新对话,
  // starts a new one. Nothing is written to storage or kept by the server.
  const [turns, setTurns] = useState<AskTurn[]>([]);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const followUpRef = useRef<HTMLInputElement>(null);
  const focusFirstInput = useRef(false);

  useEffect(() => {
    if (turns.length === 0 && focusFirstInput.current) {
      focusFirstInput.current = false;
      inputRef.current?.focus();
    }
  }, [turns.length]);

  async function ask(question: string) {
    const trimmed = question.trim();

    if (trimmed.length < 2 || running) {
      return;
    }

    // A turn that failed is dropped rather than counted: asking again
    // replaces it, and it never enters the history sent to the model.
    const earlier = turns.filter(isComplete);

    if (earlier.length >= askMaxTurns) {
      return;
    }

    const carried = turns.at(-1)?.sources ?? [];
    const history = earlier.map((turn) => ({
      question: turn.question,
      answer: turn.answer
    }));

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setTurns([...earlier, newTurn(trimmed, carried)]);

    const fail = (message: string) =>
      setTurns((current) =>
        updateLast(current, (turn) => ({ ...turn, done: true, error: message }))
      );

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          history.length > 0
            ? {
                question: trimmed,
                history,
                sources: carried.map(({ ref, key }) => ({ ref, key }))
              }
            : { question: trimmed }
        ),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        fail(payload.error ?? "回答生成失败，请稍后再试。");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.trim()) {
            const event = JSON.parse(line) as AskEvent;
            setTurns((current) =>
              updateLast(current, (turn) => applyEvent(turn, event))
            );
          }
        }
      }

      if (history.length > 0) {
        setFollowUp("");
      }
    } catch {
      if (!controller.signal.aborted) {
        fail("连接中断，请稍后再试。");
      }
    } finally {
      setRunning(false);
    }
  }

  function startOver() {
    abortRef.current?.abort();
    focusFirstInput.current = true;
    setTurns([]);
    setFollowUp("");
    setInput("");
    setRunning(false);
  }

  const last = turns.at(-1);
  const completeTurns = turns.filter(isComplete);
  const finished = Boolean(last?.done) && !running;
  const atLimit = completeTurns.length >= askMaxTurns;
  const canCopy = finished && last !== undefined && isComplete(last);

  return (
    <div className="ask-radar">
      {/* The first question keeps its box on top until it has an answer;
          after that the conversation continues from the box below it. */}
      {completeTurns.length === 0 ? (
        <QuestionForm
          value={input}
          onChange={setInput}
          onSubmit={() => void ask(input)}
          running={running}
          label="你的问题"
          placeholder="例如：本地跑大模型要注意什么？"
          submitLabel="提问"
          inputRef={inputRef}
        />
      ) : null}

      {turns.length === 0 && !running && examples.length > 0 ? (
        <div className="ask-radar__examples">
          <h2>可以这样问</h2>
          <ul>
            {examples.map((example) => (
              <li key={example}>
                {/* Fills the box, never asks: a click on a suggestion should
                    not spend a model call on the reader's behalf — the same
                    rule as arriving from /search with ?q=. */}
                <button
                  type="button"
                  className="action-button"
                  onClick={() => {
                    setInput(example);
                    inputRef.current?.focus();
                  }}
                >
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {turns.length > 0 ? (
        <section className="ask-radar__result" aria-live="polite">
          <p className="ask-radar__disclaimer">{aiGeneratedDisclaimer}</p>

          {turns.map((turn, index) => (
            <TurnView
              key={index}
              turn={turn}
              index={index}
              previousRefs={
                new Set((turns[index - 1]?.sources ?? []).map((s) => s.ref))
              }
              running={running && index === turns.length - 1}
            />
          ))}

          {finished ? (
            <div className="ask-radar__copy">
              {/* Only once the answer is final: a half-streamed answer copied
                  mid-way would carry citations the done event has not
                  checked. */}
              {canCopy ? (
                <CopyConversation key={turns.length} turns={completeTurns} />
              ) : null}
              <button
                type="button"
                className="ask-radar__copy-button"
                onClick={startOver}
              >
                开新对话
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {finished && completeTurns.length > 0 ? (
        atLimit ? (
          <p className="ask-radar__limit">
            这段对话已经问了 {askMaxTurns} 次。想继续问，请开新对话。
          </p>
        ) : (
          <QuestionForm
            className="ask-radar__followup"
            value={followUp}
            onChange={setFollowUp}
            onSubmit={() => void ask(followUp)}
            running={running}
            label="继续追问"
            placeholder={`继续追问（还可以问 ${askMaxTurns - completeTurns.length} 次）`}
            submitLabel="追问"
            inputRef={followUpRef}
          />
        )
      ) : null}
    </div>
  );
}
