"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import type { AskEvent, AskSource } from "@/lib/ask-radar";
import { splitAnswerWithCitations } from "@/lib/ask-radar-citations";

const disclaimerText = "AI 生成内容，未经编辑审核，仅供参考。";

const kindLabels: Record<AskSource["kind"], string> = {
  technology: "技术信号",
  skill: "技能",
  knowledge: "知识"
};

interface AskState {
  question: string;
  statuses: string[];
  sources: AskSource[];
  answer: string;
  done: boolean;
  cited: number[];
  invalid: number[];
  error: string;
}

const emptyState: AskState = {
  question: "",
  statuses: [],
  sources: [],
  answer: "",
  done: false,
  cited: [],
  invalid: [],
  error: ""
};

function applyEvent(state: AskState, event: AskEvent): AskState {
  switch (event.type) {
    case "status":
      return { ...state, statuses: [...state.statuses, event.text] };
    case "sources":
      return { ...state, sources: event.sources };
    case "delta":
      return { ...state, answer: state.answer + event.text };
    case "reset":
      return { ...state, answer: "" };
    case "done":
      return {
        ...state,
        done: true,
        cited: event.cited,
        invalid: event.invalid
      };
    case "error":
      return { ...state, done: true, error: event.message };
  }
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
  const paragraphs = text
    .replace(/\*\*/g, "")
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

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

export function AskRadar({
  examples,
  initialQuestion = ""
}: {
  examples: string[];
  initialQuestion?: string;
}) {
  const [input, setInput] = useState(initialQuestion);
  const [state, setState] = useState<AskState>(emptyState);
  const [running, setRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function ask(question: string) {
    const trimmed = question.trim();

    if (trimmed.length < 2 || running) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setState({ ...emptyState, question: trimmed });

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
        signal: controller.signal
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setState((current) => ({
          ...current,
          done: true,
          error: payload.error ?? "回答生成失败，请稍后再试。"
        }));
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
            setState((current) => applyEvent(current, event));
          }
        }
      }
    } catch {
      if (!controller.signal.aborted) {
        setState((current) => ({
          ...current,
          done: true,
          error: "连接中断，请稍后再试。"
        }));
      }
    } finally {
      setRunning(false);
    }
  }

  const citedSources = state.sources.filter((source) =>
    state.cited.includes(source.ref)
  );
  const uncitedSources = state.sources.filter(
    (source) => !state.cited.includes(source.ref)
  );
  const hasRun = state.question.length > 0;

  return (
    <div className="ask-radar">
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(input);
        }}
      >
        <div className="dossier-search">
          <input
            type="search"
            name="question"
            value={input}
            maxLength={200}
            onChange={(event) => setInput(event.target.value)}
            placeholder="例如：本地跑大模型要注意什么？"
            aria-label="你的问题"
          />
        </div>
        <button
          type="submit"
          className="action-button action-button--primary"
          disabled={running || input.trim().length < 2}
        >
          {running ? "回答中…" : "提问"}
        </button>
      </form>

      {!hasRun ? (
        <div className="ask-radar__examples">
          <span>试试：</span>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              className="dossier-stamp-tag dossier-stamp-tag--interactive"
              onClick={() => {
                setInput(example);
                void ask(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}

      {hasRun ? (
        <section className="ask-radar__result" aria-live="polite">
          <p className="ask-radar__disclaimer">{disclaimerText}</p>

          {state.statuses.length > 0 ? (
            <ul className="ask-radar__statuses">
              {state.statuses.map((status, index) => (
                <li key={index}>{status}</li>
              ))}
            </ul>
          ) : null}

          {state.answer ? (
            <AnswerText
              text={state.answer}
              sources={state.sources}
              invalid={state.invalid}
            />
          ) : running ? (
            <p className="ask-radar__pending">正在查找站内内容…</p>
          ) : null}

          {state.error ? (
            <p className="ask-radar__error">{state.error}</p>
          ) : null}

          {state.done && citedSources.length > 0 ? (
            <div className="ask-radar__block">
              <h2>引用</h2>
              <SourceList sources={citedSources} />
            </div>
          ) : null}

          {state.done && uncitedSources.length > 0 ? (
            <details className="ask-radar__block">
              <summary>检索到但没有引用（{uncitedSources.length}）</summary>
              <SourceList sources={uncitedSources} />
            </details>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
