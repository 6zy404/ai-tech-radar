import Link from "next/link";
import { Fragment, type ReactNode } from "react";

import { parseContentBody, splitContentBodyInline } from "@/lib/content-body";
import {
  createKnowledgeLinker,
  type KnowledgeLinkTarget
} from "@/lib/knowledge-autolink";

type Linker = ReturnType<typeof createKnowledgeLinker>;

// Text runs pass through the linker; headings and inline code never do.
function renderText(text: string, linker?: Linker): ReactNode {
  if (!linker) {
    return text;
  }

  return linker(text).map((piece, index) =>
    piece.link ? (
      <Link
        key={index}
        href={piece.link.href}
        className="content-body__knowledge-link"
        title={piece.link.title}
      >
        {piece.text}
      </Link>
    ) : (
      <Fragment key={index}>{piece.text}</Fragment>
    )
  );
}

function renderInline(text: string, linker?: Linker): ReactNode {
  return splitContentBodyInline(text).map((segment, index) => {
    if (segment.kind === "strong") {
      return <strong key={index}>{renderText(segment.text, linker)}</strong>;
    }

    if (segment.kind === "code") {
      return (
        <code key={index} className="content-body__code">
          {segment.text}
        </code>
      );
    }

    return <Fragment key={index}>{renderText(segment.text, linker)}</Fragment>;
  });
}

export function ContentBody({
  body,
  className,
  knowledgeLinks
}: {
  body: string;
  className?: string;
  /** Link each item's first mention to its /knowledge page. */
  knowledgeLinks?: KnowledgeLinkTarget[];
}) {
  const blocks = parseContentBody(body);

  if (blocks.length === 0) {
    return null;
  }

  // One linker per render, walked in reading order, so an item links once.
  const linker = knowledgeLinks?.length
    ? createKnowledgeLinker(knowledgeLinks)
    : undefined;

  return (
    <div className={className ? `content-body ${className}` : "content-body"}>
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h3 key={index} className="content-body__heading">
              {renderInline(block.text)}
            </h3>
          );
        }

        if (block.kind === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item, linker)}</li>
          ));

          return block.ordered ? (
            <ol key={index} className="content-body__list">
              {items}
            </ol>
          ) : (
            <ul key={index} className="content-body__list">
              {items}
            </ul>
          );
        }

        return (
          <p key={index} className="content-body__paragraph">
            {renderInline(block.text, linker)}
          </p>
        );
      })}
    </div>
  );
}
