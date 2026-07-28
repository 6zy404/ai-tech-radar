import { Fragment, type ReactNode } from "react";

import {
  parseTechnologyBody,
  splitTechnologyBodyInline
} from "@/lib/technology-body";

function renderInline(text: string): ReactNode {
  return splitTechnologyBodyInline(text).map((segment, index) =>
    segment.strong ? (
      <strong key={index}>{segment.text}</strong>
    ) : (
      <Fragment key={index}>{segment.text}</Fragment>
    )
  );
}

export function TechnologyBody({
  body,
  className
}: {
  body: string;
  className?: string;
}) {
  const blocks = parseTechnologyBody(body);

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div
      className={className ? `technology-body ${className}` : "technology-body"}
    >
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <h3 key={index} className="technology-body__heading">
              {renderInline(block.text)}
            </h3>
          );
        }

        if (block.kind === "list") {
          const items = block.items.map((item, itemIndex) => (
            <li key={itemIndex}>{renderInline(item)}</li>
          ));

          return block.ordered ? (
            <ol key={index} className="technology-body__list">
              {items}
            </ol>
          ) : (
            <ul key={index} className="technology-body__list">
              {items}
            </ul>
          );
        }

        return (
          <p key={index} className="technology-body__paragraph">
            {renderInline(block.text)}
          </p>
        );
      })}
    </div>
  );
}
