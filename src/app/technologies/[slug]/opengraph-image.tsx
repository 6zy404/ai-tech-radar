import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getTechnologyBySlug } from "@/lib/content";
import { buildShareCard, shareCardSize } from "@/lib/share-card";

// The share card a link preview shows for a signal page. Layout decisions
// (which fields, where the title wraps, when it is cut) live in
// src/lib/share-card.ts; this file only paints them.

export const alt = "AI Tech Radar 技术信号卡片";
export const size = shareCardSize;
export const contentType = "image/png";

// Dossier tokens (light theme), see docs/design-system.md → "Dossier direction".
const ground = "#e6e7de";
const surface = "#f8f6ee";
const line = "#c9c5b2";
const ink = "#2b2a22";
const muted = "#62604f";
const accent = "#34524a";
const stamp = "#8a3b2a";

// A subset of Noto Serif SC Bold (SIL OFL 1.1): GB2312 level 1 plus every
// character in the published content at the time it was cut. A character
// outside it falls back to next/og's own on-demand font fetch.
let fontData: Promise<Buffer> | undefined;

function loadFont(): Promise<Buffer> {
  fontData ??= readFile(
    join(process.cwd(), "assets/fonts/NotoSerifSC-Bold.share-card.otf")
  );
  return fontData;
}

export default async function Image({ params }: { params: { slug: string } }) {
  const card = buildShareCard(getTechnologyBySlug(params.slug));
  const font = await loadFont();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        padding: 36,
        background: ground,
        fontFamily: "Share Card Serif"
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "44px 62px 40px",
          background: surface,
          border: `2px solid ${line}`,
          borderRadius: 4
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 24,
            borderBottom: `1px solid ${line}`
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: stamp,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 13,
                  border: `4px solid ${surface}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    background: surface
                  }}
                />
              </div>
            </div>
            <div style={{ fontSize: 30, color: ink, letterSpacing: 1 }}>
              {card.siteName}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              padding: "6px 16px",
              border: `2px solid ${stamp}`,
              borderRadius: 3,
              color: stamp,
              fontSize: 24,
              letterSpacing: 2
            }}
          >
            {card.stamp}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center"
          }}
        >
          {card.title.lines.map((titleLine, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                fontSize: card.title.fontSize,
                lineHeight: 1.28,
                color: ink,
                whiteSpace: "nowrap"
              }}
            >
              {titleLine}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 22,
            borderTop: `2px solid ${accent}`,
            fontSize: 28,
            color: muted
          }}
        >
          <div style={{ display: "flex", whiteSpace: "nowrap" }}>
            {card.byline}
          </div>
          {card.date ? (
            <div style={{ display: "flex", letterSpacing: 1 }}>{card.date}</div>
          ) : null}
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Share Card Serif", data: font, weight: 700, style: "normal" }
      ],
      // next/og defaults to `immutable, max-age=31536000`, but the `?hash`
      // Next appends to og:image tracks this file, not the signal: an edited
      // title would stay stale for a year. A render costs about 0.1s, so a
      // short lifetime is cheap. The fallback card is shorter still, because
      // its slug may be published later.
      headers: {
        "Cache-Control":
          card.kind === "signal"
            ? "public, max-age=3600"
            : "public, max-age=300"
      }
    }
  );
}
