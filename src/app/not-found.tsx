import type { Metadata } from "next";
import Link from "next/link";

import { UserPageShell } from "@/components/user-page-shell";

// Until 2026-09-24 every notFound() on the site — an unknown signal slug, a
// topic with no content, a non-Monday week key — showed Next's default English
// page. This is the Chinese one, in the same dossier register as the rest of
// the public site.
export const metadata: Metadata = {
  title: "没有这一页",
  robots: { index: false, follow: false }
};

export default function NotFound() {
  return (
    <UserPageShell
      title="没有这一页"
      description="这个地址对应的信号、技能或知识不存在，可能已被归档，或者从未发布。"
      sectionLabel="未收录"
      className="dossier"
    >
      <section className="empty-state empty-state--actionable">
        <strong>可以从这里继续。</strong>
        <p>
          <Link className="action-link" href="/">
            回到首页
          </Link>
          {" · "}
          <Link className="action-link" href="/technologies">
            浏览技术信号
          </Link>
          {" · "}
          <Link className="action-link" href="/search">
            站内搜索
          </Link>
        </p>
      </section>
    </UserPageShell>
  );
}
