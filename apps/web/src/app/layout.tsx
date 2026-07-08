import type { Metadata } from "next";
import { Geist } from "next/font/google";

import "./globals.css";
import { SiteHeader } from "@/components/site-header";


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
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg",
  },
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={geist.variable}>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <div id="main-content">{children}</div>
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
