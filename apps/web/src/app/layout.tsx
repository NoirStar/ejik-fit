import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";

import "./globals.css";


const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});


export const metadata: Metadata = {
  title: {
    default: "이직핏 | 기업 공식 채용공고 탐색",
    template: "%s | 이직핏",
  },
  description:
    "한국 기술기업의 공식 채용페이지를 모아 검색하고 비교합니다.",
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={geist.variable}>
        <header className="site-header">
          <div className="site-header__inner">
            <Link href="/" className="brand" aria-label="이직핏 홈">
              이직핏
            </Link>
            <p>기업이 올린 공고를, 기업에서 직접.</p>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <p>공식 채용페이지의 공개 정보만 수집합니다.</p>
          <a
            href="https://github.com/NoirStar/ejik-fit"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </footer>
      </body>
    </html>
  );
}
