"use client";

import Link from "next/link";
import { useEffect } from "react";

import { UserPageShell } from "@/components/user-page-shell";

// Route-level error boundary. It must be a client component (Next requires
// it), it never shows the error text to the reader — that could carry a file
// path or a provider message — and it logs the digest so the server log has
// something to search for.
export default function RouteError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[route error]", error.digest ?? error.message);
  }, [error]);

  return (
    <UserPageShell
      title="这一页暂时打不开"
      description="服务端处理这个请求时出了问题，已经记录下来。可以重试一次，或者回到首页。"
      sectionLabel="出错了"
      className="dossier"
    >
      <section className="empty-state empty-state--actionable">
        <strong>请再试一次。</strong>
        <p>
          <button className="action-link" type="button" onClick={reset}>
            重新加载这一页
          </button>
          {" · "}
          <Link className="action-link" href="/">
            回到首页
          </Link>
        </p>
      </section>
    </UserPageShell>
  );
}
