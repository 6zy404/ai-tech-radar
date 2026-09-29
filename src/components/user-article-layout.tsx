import type { ReactNode } from "react";

interface UserArticleLayoutProps {
  hero: ReactNode;
  children: ReactNode;
  aside?: ReactNode;
  className?: string;
}

export function UserArticleLayout({
  hero,
  children,
  aside,
  className
}: UserArticleLayoutProps) {
  const rootClassName = ["user-article-layout", className]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={rootClassName}>
      <div className="user-article-layout__hero">{hero}</div>
      <div className="user-article-layout__body">
        {/* A <div>, not a <main>: the layout's <main> already wraps every
            page, and a second one inside it is a second main landmark. */}
        <div className="user-article-layout__main">{children}</div>
        {aside ? (
          <aside className="user-article-layout__aside">{aside}</aside>
        ) : null}
      </div>
    </article>
  );
}
