import Link from "next/link";
import {
  Bell,
  Briefcase,
  Buildings,
  CalendarDots,
  GearSix,
  Graph,
  Question,
  SlidersHorizontal,
  SquaresFour,
} from "@phosphor-icons/react";

import { BrandMark } from "@/components/brand/brand-mark";


const NAV_ITEMS = [
  { type: "link", href: "/", label: "대시보드", icon: SquaresFour, active: true },
  { type: "link", href: "/#weekly-jobs", label: "공고 탐색", icon: Briefcase, active: false },
  { type: "link", href: "/skills/graph", label: "기술 분석", icon: Graph, active: false },
  { type: "disabled", label: "기업 분석", icon: Buildings },
  { type: "disabled", label: "채용달력", icon: CalendarDots },
  { type: "link", href: "/#my-stack", label: "내 스택 관리", icon: GearSix, active: false },
  { type: "disabled", label: "알림", icon: Bell },
  { type: "disabled", label: "설정", icon: SlidersHorizontal },
] as const;


export function DashboardShell({
  children,
  stackPanel,
}: Readonly<{
  children: React.ReactNode;
  stackPanel?: React.ReactNode;
}>) {
  return (
    <section className="daily-shell" aria-label="이직핏 대시보드">
      <aside className="daily-rail" aria-label="주요 메뉴">
        <Link className="daily-brand" href="/" aria-label="이직핏 대시보드 홈">
          <BrandMark size="md" />
        </Link>
        <nav className="daily-nav" aria-label="대시보드 탐색">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            if (item.type === "disabled") {
              return (
                <button
                  aria-disabled="true"
                  className="is-disabled"
                  disabled
                  key={item.label}
                  title={`${item.label} 기능은 다음 단계에서 연결됩니다.`}
                  type="button"
                >
                  <Icon size={19} weight="light" aria-hidden />
                  <span>{item.label}</span>
                  <small>준비중</small>
                </button>
              );
            }

            return (
              <Link
                aria-current={item.active ? "page" : undefined}
                className={item.active ? "is-active" : ""}
                href={item.href}
                key={item.label}
              >
                <Icon size={19} weight={item.active ? "duotone" : "light"} aria-hidden />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="daily-rail__footer">
          {stackPanel}
          <button className="daily-help-button" type="button">
            <Question size={18} weight="bold" aria-hidden />
            도움말
          </button>
        </div>
      </aside>
      {children}
    </section>
  );
}
