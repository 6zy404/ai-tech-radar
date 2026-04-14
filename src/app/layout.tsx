import type { Metadata } from "next";
import type { ReactNode } from "react";

import { TopNav } from "@/components/top-nav";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Tech Radar",
  description:
    "A local prototype for tracking new technologies, hot skills, and classic knowledge."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TopNav />
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
