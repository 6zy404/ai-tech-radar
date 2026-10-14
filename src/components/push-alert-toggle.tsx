"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { signalsCopy } from "@/lib/i18n/copy/signals";
import { localePath } from "@/lib/i18n/locale";
import { useLocale } from "@/lib/i18n/use-locale";

import {
  disablePush,
  enablePush,
  fetchPushConfig,
  getCurrentPushSubscription,
  isPushSupported
} from "@/lib/push-client";

type ToggleState = "loading" | "hidden" | "unsupported" | "off" | "on" | "busy";

interface PushAlertToggleProps {
  followedTagIds: string[];
}

// 「有新信号时提醒我」 in the 我关注的 view. Renders nothing when the server has
// push switched off. While the state loads it holds one line of space, so
// the button appearing does not move the cards below. The topics it sends are
// the follows at the moment of switching on; later changes are synced by
// PwaRegistration on every page.
export function PushAlertToggle({ followedTagIds }: PushAlertToggleProps) {
  const locale = useLocale();
  const copy = signalsCopy[locale].push;
  const [state, setState] = useState<ToggleState>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const config = await fetchPushConfig();

      if (cancelled) {
        return;
      }

      if (!config.enabled) {
        setState("hidden");
        return;
      }

      if (!isPushSupported()) {
        setState("unsupported");
        return;
      }

      const subscription = await getCurrentPushSubscription().catch(() => null);

      if (!cancelled) {
        setState(subscription ? "on" : "off");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "hidden") {
    return null;
  }

  const isOn = state === "on";

  const handleClick = async () => {
    setState("busy");
    setMessage("");

    if (isOn) {
      const result = await disablePush(locale);
      setState(result.ok ? "off" : "on");
      setMessage(result.ok ? copy.turnedOff : (result.message ?? ""));
      return;
    }

    const result = await enablePush(followedTagIds, locale);

    if (result.ok) {
      setState("on");
      setMessage(copy.turnedOn(followedTagIds.length));
    } else {
      setState(result.reason === "unsupported" ? "unsupported" : "off");
      setMessage(result.message);
    }
  };

  return (
    // Not a live region as a whole: the button and its note arrive together
    // once the state loads, and that arrival is not news. Only the result of
    // a click is announced, through the status span in the note.
    <div className="push-alert-toggle">
      {state === "loading" ? (
        <span className="push-alert-toggle__placeholder" aria-hidden="true" />
      ) : state === "unsupported" ? (
        <p className="push-alert-toggle__note">{copy.unsupported}</p>
      ) : (
        <>
          <button
            type="button"
            className={`my-radar__tag-toggle${isOn ? " my-radar__tag-toggle--active" : ""}`}
            aria-pressed={isOn}
            disabled={
              state === "busy" || (!isOn && followedTagIds.length === 0)
            }
            onClick={handleClick}
          >
            <span aria-hidden="true">{isOn ? "✓ " : "+ "}</span>
            {copy.toggle}
          </button>
          <span className="push-alert-toggle__note">
            <span role="status">{message}</span>
            {message ? null : isOn ? copy.onNote : copy.offNote}
            {!message && !isOn ? (
              <Link
                className="action-link"
                href={localePath(locale, "/about#privacy")}
              >
                {copy.privacyLink}
              </Link>
            ) : null}
          </span>
        </>
      )}
    </div>
  );
}
