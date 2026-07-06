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
    default: "이직핏 | 기술 스택 기반 커리어 인텔리전스",
    template: "%s | 이직핏",
  },
  description:
    "한국 기술기업의 공식 채용공고를 분석해 기술 스택, 인접 분야, 부족한 준비 항목을 그래프로 보여줍니다.",
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
              ejik
            </Link>
            <nav className="site-nav" aria-label="주요 탐색">
              <Link href="/skills/graph">스킬맵</Link>
              <Link href="/#jobs">공고분석</Link>
              <Link href="/#trends">기술통계</Link>
              <Link href="/#roadmap">커리어 로드맵</Link>
            </nav>
            <p>Graph + Dashboard career intelligence</p>
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
