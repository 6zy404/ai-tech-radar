import type { ReactNode } from "react";

interface UserArticleLayoutProps {
  hero: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
}

export function UserArticleLayout({
  hero,
  children,
  aside
}: UserArticleLayoutProps) {
  return (
    <article className="user-article-layout">
      <div className="user-article-layout__hero">{hero}</div>
      <div className="user-article-layout__body">
        <main className="user-article-layout__main">{children}</main>
        {aside ? <aside className="user-article-layout__aside">{aside}</aside> : null}
      </div>
    </article>
  );
}
