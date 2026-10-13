"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
      const result = await disablePush();
      setState(result.ok ? "off" : "on");
      setMessage(
        result.ok
          ? "已关闭提醒，服务器上的记录已删除。"
          : (result.message ?? "")
      );
      return;
    }

    const result = await enablePush(followedTagIds);

    if (result.ok) {
      setState("on");
      setMessage(
        `已开启：${followedTagIds.length} 个关注话题有新信号时，这个浏览器会收到一条通知。`
      );
    } else {
      setState(result.reason === "unsupported" ? "unsupported" : "off");
      setMessage(result.message);
    }
  };

  return (
    <div className="push-alert-toggle" aria-live="polite">
      {state === "loading" ? (
        <span className="push-alert-toggle__placeholder" aria-hidden="true" />
      ) : state === "unsupported" ? (
        <p className="push-alert-toggle__note">
          这个浏览器不支持网页提醒（iPhone 和 iPad 需要先「添加到主屏幕」）。
        </p>
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
            {isOn ? "✓ " : "+ "}有新信号时提醒我
          </button>
          <span className="push-alert-toggle__note">
            {message ||
              (isOn
                ? "关注的话题有新信号时会收到浏览器通知。"
                : "开启后，服务器会存下这个浏览器的推送地址和你关注的话题，")}
            {!message && !isOn ? (
              <Link className="action-link" href="/about#privacy">
                存什么、怎么删
              </Link>
            ) : null}
          </span>
        </>
      )}
    </div>
  );
}
