import { Fragment, type ReactNode } from "react";

import { parseContentBody, splitContentBodyInline } from "@/lib/content-body";

function renderInline(text: string): ReactNode {
  return splitContentBodyInline(text).map((segment, index) => {
    if (segment.kind === "strong") {
      return <strong key={index}>{segment.text}</strong>;
    }

    if (segment.kind === "code") {
      return (
        <code key={index} className="content-body__code">
          {segment.text}
        </code>
      );
    }

    return <Fragment key={index}>{segment.text}</Fragment>;
  });
}

export function ContentBody({
  body,
  className
}: {
  body: string;
  className?: string;
}) {
  const blocks = parseContentBody(body);

  if (blocks.length === 0) {
    return null;
  }

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
            <li key={itemIndex}>{renderInline(item)}</li>
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
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
