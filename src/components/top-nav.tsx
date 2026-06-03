"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/digest/today", label: "Daily Digest" },
  { href: "/technologies", label: "Technologies" },
  { href: "/skills", label: "Skills" },
  { href: "/knowledge", label: "Knowledge" },
  { href: "/workspace", label: "Internal Workspace" }
];

function isActiveNavItem(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/digest/today") {
    return pathname.startsWith("/digest");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="top-nav">
      <div className="top-nav__inner">
        <Link href="/" className="brand">
          AI Tech Radar
        </Link>
        <nav>
          <ul className="top-nav__list">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={[
                    "top-nav__link",
                    isActiveNavItem(pathname, item.href) ? "top-nav__link--active" : "",
                    item.href === "/workspace" ? "top-nav__link--workspace" : ""
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
