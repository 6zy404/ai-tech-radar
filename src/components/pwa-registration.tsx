"use client";

import { useEffect } from "react";

import { followedTagsChangedEventName } from "@/lib/followed-tags";
import { syncPushTopics } from "@/lib/push-client";
import { pwaSavedIdsMessageType } from "@/lib/pwa-service-worker";
import {
  readMarkedTechnologyIds,
  readingStateChangedEventName
} from "@/lib/reading-state";

const pushSyncedThisSessionKey = "ai-tech-radar:push-synced";
const pushSyncDelayMs = 1500;

// Mounted once, in the root layout; renders nothing. Three jobs:
//
// 1. Registers /sw.js.
// 2. Tells the worker which signals are saved for 稍后读, so it keeps offline
//    copies of exactly those pages. The ids go to the worker in this browser
//    — a postMessage, not a request — and the worker resolves them against a
//    map that is the same for every reader.
// 3. If the reader turned on 「有新信号时提醒我」, re-sends the followed topics
//    whenever they change on any page (a tag chip on a detail page, the topic
//    hub, 我关注的), batched so a run of clicks is one request; and once per
//    browser session, so a server record lost or pruned comes back.
export function PwaRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    let cancelled = false;
    let pushSyncTimer: number | undefined;

    const postSavedIds = () => {
      void navigator.serviceWorker.ready.then((registration) => {
        registration.active?.postMessage({
          type: pwaSavedIdsMessageType,
          ids: readMarkedTechnologyIds("saved")
        });
      });
    };

    const schedulePushSync = () => {
      window.clearTimeout(pushSyncTimer);
      pushSyncTimer = window.setTimeout(() => {
        void syncPushTopics().catch(() => undefined);
      }, pushSyncDelayMs);
    };

    const onStorage = (event: StorageEvent) => {
      postSavedIds();

      if (event.key === null || event.key.includes("followed-tag")) {
        schedulePushSync();
      }
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then(() => {
        if (cancelled) {
          return;
        }

        postSavedIds();

        try {
          if (!window.sessionStorage.getItem(pushSyncedThisSessionKey)) {
            window.sessionStorage.setItem(pushSyncedThisSessionKey, "1");
            schedulePushSync();
          }
        } catch {
          // No session storage: skip the once-per-session refresh.
        }
      })
      .catch(() => {
        // No worker (blocked, private mode, plain http): the site works as before.
      });

    window.addEventListener(readingStateChangedEventName, postSavedIds);
    window.addEventListener(followedTagsChangedEventName, schedulePushSync);
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      window.clearTimeout(pushSyncTimer);
      window.removeEventListener(readingStateChangedEventName, postSavedIds);
      window.removeEventListener(
        followedTagsChangedEventName,
        schedulePushSync
      );
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
