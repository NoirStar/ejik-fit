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
    default: "이직핏 | 커리어 네트워크",
    template: "%s | 이직핏",
  },
  description: "채용공고의 기술 수요와 내 기술을 비교하는 이직핏입니다.",
  applicationName: "이직핏",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: "이직핏",
    title: "이직핏 | 커리어 네트워크",
    description: "채용공고의 기술 수요와 내 기술을 비교하는 이직핏입니다.",
  },
  twitter: {
    card: "summary",
    title: "이직핏 | 커리어 네트워크",
    description: "채용공고의 기술 수요와 내 기술을 비교하는 이직핏입니다.",
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
