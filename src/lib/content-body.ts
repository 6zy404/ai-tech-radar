export type ContentBodyBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] };

const ORDERED_ITEM = /^\d+\.\s+/;
const BULLETED_ITEM = /^[-*]\s+/;

// The editorial bodies only ever use four constructs (## headings, **bold**,
// and ordered / bulleted lists), so this stays a deliberate subset of Markdown
// rather than a dependency. Anything else is preserved as plain paragraph text.
export function parseContentBody(body: string): ContentBodyBlock[] {
  const blocks: ContentBodyBlock[] = [];
  const list = { ordered: false, items: [] as string[] };
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraphLines.join("") });
      paragraphLines = [];
    }
  };

  const flush = () => {
    if (list.items.length > 0) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
      list.items = [];
    }
    flushParagraph();
  };

  for (const rawLine of body.split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flush();
      continue;
    }

    const marker = ORDERED_ITEM.exec(line) ?? BULLETED_ITEM.exec(line);

    if (marker) {
      const ordered = ORDERED_ITEM.test(line);
      if (list.items.length > 0 && list.ordered !== ordered) {
        flush();
      }
      flushParagraph();
      list.ordered = ordered;
      list.items.push(line.slice(marker[0].length));
      continue;
    }

    if (list.items.length > 0) {
      flush();
    }

    if (line.startsWith("## ")) {
      flushParagraph();
      blocks.push({ kind: "heading", text: line.slice(3) });
      continue;
    }

    paragraphLines.push(line);
  }

  flush();
  return blocks;
}

export type ContentBodyInlineSegment = {
  text: string;
  strong: boolean;
};

export function splitContentBodyInline(
  text: string
): ContentBodyInlineSegment[] {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter((part) => part.length > 0)
    .map((part) =>
      part.startsWith("**") && part.endsWith("**")
        ? { text: part.slice(2, -2), strong: true }
        : { text: part, strong: false }
    );
}
