import Link from "next/link";
import {
  Briefcase,
  CalendarDots,
  ChartLineUp,
  GearSix,
  Graph,
  SquaresFour,
} from "@phosphor-icons/react";

import { BrandMark } from "@/components/brand/brand-mark";


const NAV_ITEMS = [
  { type: "link", href: "/", label: "대시보드", icon: SquaresFour, active: true },
  { type: "link", href: "/#jobs", label: "공고 탐색", icon: Briefcase, active: false },
  { type: "link", href: "/#signals", label: "트렌드", icon: ChartLineUp, active: false },
  { type: "link", href: "/skills/graph", label: "기술 맵", icon: Graph, active: false },
  { type: "disabled", label: "채용 캘린더", icon: CalendarDots },
  { type: "disabled", label: "내 스택", icon: GearSix },
] as const;


export function DashboardShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
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
      </aside>
      {children}
    </section>
  );
}
