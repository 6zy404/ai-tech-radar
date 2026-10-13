"use client";

import { useEffect, useState } from "react";

import {
  pwaSavedCachePrefix,
  pwaSavedIndexKey
} from "@/lib/pwa-service-worker";

interface SavedPage {
  url: string;
  title: string;
}

const siteTitleSuffix = / · AI Tech Radar$/;

// Reads the saved-pages index the service worker keeps in its cache. Plain
// <a>, not <Link>: offline, a client-side navigation would try to fetch an RSC
// payload, which the worker deliberately does not cache.
export function PwaOfflineSavedList() {
  const [pages, setPages] = useState<SavedPage[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (typeof caches === "undefined") {
        setPages([]);
        return;
      }

      try {
        const names = await caches.keys();
        const savedName = names.find((name) =>
          name.startsWith(pwaSavedCachePrefix)
        );
        const index = savedName
          ? await (await caches.open(savedName)).match(pwaSavedIndexKey)
          : undefined;
        const parsed = index
          ? ((await index.json()) as { pages?: SavedPage[] })
          : {};

        if (!cancelled) {
          setPages(Array.isArray(parsed.pages) ? parsed.pages : []);
        }
      } catch {
        if (!cancelled) {
          setPages([]);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (pages === null) {
    return null;
  }

  if (pages.length === 0) {
    return (
      <section className="empty-state">
        <strong>这台设备上还没有可离线阅读的信号。</strong>
        <p>
          联网时在信号卡片上点「稍后读」，这个浏览器会自动存一份，离线时就能打开。
        </p>
      </section>
    );
  }

  return (
    <section
      className="pwa-offline-saved"
      aria-labelledby="pwa-offline-saved-title"
    >
      <h2 id="pwa-offline-saved-title">可以离线打开的稍后读</h2>
      <ul>
        {pages.map((page) => (
          <li key={page.url}>
            <a href={page.url}>{page.title.replace(siteTitleSuffix, "")}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
