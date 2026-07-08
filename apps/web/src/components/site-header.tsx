"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand/brand-mark";


const NAV_ITEMS = [
  { href: "/skills/graph", label: "대시보드" },
  { href: "/#jobs", label: "공고" },
  { href: "/#trends", label: "트렌드" },
  { href: "/#roadmap", label: "로드맵" },
];


function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }
  if (href.startsWith("/#")) {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}


export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const dashboardShell =
    pathname === "/" || pathname === "/skills/graph" || pathname.startsWith("/skills/graph/");

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  if (dashboardShell) {
    return null;
  }

  return (
    <header className={`site-header ${open ? "site-header--open" : ""}`}>
      <div className="site-header__inner site-header__shell">
        <Link href="/" className="brand" aria-label="이직핏 홈">
          <BrandMark size="sm" />
        </Link>
        <nav className="site-nav site-nav--desktop" aria-label="주요 탐색">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`site-nav__link ${active ? "is-active" : ""}`}
                href={item.href}
                key={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <p className="site-header__tagline">
          내 기술이 맞는 시장을 찾다
        </p>
        <button
          aria-controls="site-mobile-menu"
          aria-expanded={open}
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          className="site-menu-button"
          type="button"
          onClick={() => setOpen((current) => !current)}
        >
          <span />
          <span />
        </button>
      </div>

      {open && (
        <div className="site-mobile-panel" id="site-mobile-menu">
          <nav aria-label="모바일 주요 탐색">
            {NAV_ITEMS.map((item, index) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={active ? "is-active" : ""}
                  href={item.href}
                  key={item.href}
                  style={{ "--nav-index": index } as CSSProperties}
                >
                  <span>{item.label}</span>
                  <b>{active ? "현재 위치" : "이동"}</b>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
