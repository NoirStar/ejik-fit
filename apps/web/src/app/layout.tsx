import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { AppShell } from "@/components/app-shell/app-shell";
import { siteUrl } from "@/lib/site-url";
import "@/styles/tokens.css";
import "@/styles/reset.css";
import "@/styles/typography.css";
import "@/styles/motion.css";
import "./globals.css";


const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
});


export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "커리어핏 | 경력과 채용공고를 연결하는 커리어 분석",
    template: "%s | 커리어핏",
  },
  description:
    "내 기술과 경력을 바탕으로 이어갈 수 있는 커리어 방향과 관련 채용공고를 확인합니다.",
  applicationName: "커리어핏",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "커리어핏",
    title: "커리어핏 | 경력과 채용공고를 연결하는 커리어 분석",
    description:
      "내 기술과 경력을 바탕으로 이어갈 수 있는 커리어 방향과 관련 채용공고를 확인합니다.",
    images: [
      {
        url: "/brand/ejik-fit-mascot.png",
        width: 512,
        height: 512,
        alt: "커리어핏",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "커리어핏 | 경력과 채용공고를 연결하는 커리어 분석",
    description:
      "내 기술과 경력을 바탕으로 이어갈 수 있는 커리어 방향과 관련 채용공고를 확인합니다.",
    images: ["/brand/ejik-fit-mascot.png"],
  },
  icons: {
    icon: "/brand/ejik-fit-mascot.png",
    apple: "/brand/ejik-fit-mascot-apple.png",
  },
};


export const viewport: Viewport = {
  colorScheme: "light",
  initialScale: 1,
  viewportFit: "cover",
  width: "device-width",
};


export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="ko">
      <head>
        <link
          href="/fonts/pretendard/pretendardvariable-dynamic-subset.min.css"
          rel="stylesheet"
        />
      </head>
      <body className={geist.variable}>
        <a className="skip-link" href="#main-content">
          본문으로 건너뛰기
        </a>
        <div id="main-content">
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
