import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";

import { TopNav } from "@/components/top-nav";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

export const metadata: Metadata = {
  title: "AI Tech Radar",
  description: "用于跟踪新技术、热门技能与经典知识的本地原型。"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" className={inter.variable}>
      <body>
        <TopNav />
        <main className="main-content">{children}</main>
      </body>
    </html>
  );
}
