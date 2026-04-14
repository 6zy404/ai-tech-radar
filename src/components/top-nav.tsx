import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/technologies", label: "Technologies" },
  { href: "/skills", label: "Skills" },
  { href: "/knowledge", label: "Knowledge" }
];

export function TopNav() {
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
                <Link href={item.href} className="top-nav__link">
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
