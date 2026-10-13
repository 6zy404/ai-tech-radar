import type { MetadataRoute } from "next";

import { siteDescription, siteName } from "@/lib/site-metadata";

// /manifest.webmanifest — makes the site installable. Next adds the
// <link rel="manifest"> to every page on its own. Colours are the dossier
// tokens (--dossier-stamp for the theme, --dossier-surface for the splash);
// the icons come from scripts/generate-pwa-icons.mjs.

// Nothing here reads the store, so prerendering it is right; declared because
// validate:deployment holds every metadata route to an explicit render mode.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: "Tech Radar",
    description: siteDescription,
    lang: "zh-CN",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f6ee",
    theme_color: "#8a3b2a",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ],
    shortcuts: [
      { name: "我关注的", url: "/technologies?view=followed" },
      { name: "稍后读", url: "/technologies?view=saved" }
    ]
  };
}
