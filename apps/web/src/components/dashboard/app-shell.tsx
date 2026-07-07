import Link from "next/link";
import {
  Briefcase,
  CalendarDots,
  ChartLineUp,
  GearSix,
  Graph,
  SquaresFour,
} from "@phosphor-icons/react";


const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: SquaresFour, active: true },
  { href: "/#jobs", label: "공고 탐색", icon: Briefcase, active: false },
  { href: "/#signals", label: "트렌드", icon: ChartLineUp, active: false },
  { href: "/skills/graph", label: "기술 맵", icon: Graph, active: false },
  { href: "/#calendar", label: "채용 캘린더", icon: CalendarDots, active: false },
  { href: "/#settings", label: "내 스택", icon: GearSix, active: false },
];


export function DashboardShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <section className="daily-shell" aria-label="기술 채용 인텔리전스 대시보드">
      <aside className="daily-rail" aria-label="주요 메뉴">
        <Link className="daily-brand" href="/" aria-label="ejik 대시보드 홈">
          e
        </Link>
        <nav className="daily-nav" aria-label="대시보드 탐색">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                aria-current={item.active ? "page" : undefined}
                className={item.active ? "is-active" : ""}
                href={item.href}
                key={item.label}
              >
                <Icon size={19} weight={item.active ? "fill" : "regular"} aria-hidden />
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
