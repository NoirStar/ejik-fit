"use client";

import {
  Briefcase,
  Graph,
  House,
  Stack,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useCallback, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { OwnedSkillsSheet } from "@/features/owned-skills/owned-skills-sheet";

import styles from "./app-shell.module.css";

const NAV_ITEMS = [
  { href: "/", label: "홈", icon: House },
  { href: "/jobs", label: "공고 탐색", icon: Briefcase },
  { href: "/skills/graph", label: "기술 맵", icon: Graph },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const stackButtonRef = useRef<HTMLButtonElement>(null);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <Link aria-label="이직핏 홈" className={styles.brand} href="/">
          <BrandMark size="sm" />
        </Link>

        <nav aria-label="제품 탐색" className={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={styles.navItem}
                data-active={active ? "true" : undefined}
                href={item.href}
                key={item.href}
              >
                <Icon aria-hidden="true" size={20} weight={active ? "fill" : "regular"} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <button
            aria-label="내 스택 열기"
            className={styles.navItem}
            onClick={() => setSheetOpen(true)}
            ref={stackButtonRef}
            type="button"
          >
            <Stack aria-hidden="true" size={20} />
            <span>내 스택</span>
          </button>
        </nav>
      </aside>

      <div className={styles.content}>
        {children}
        <footer className={styles.footer}>
          <p>공식 채용페이지의 공개 정보만 수집합니다.</p>
          <nav aria-label="서비스 정책">
            <Link href="/data-policy">데이터 정책</Link>
            <Link href="/methodology">분석 방법</Link>
            <Link href="/privacy">개인정보</Link>
            <Link href="/corrections">정정 요청</Link>
            <a href="https://github.com/NoirStar/ejik-fit" rel="noreferrer" target="_blank">
              GitHub
            </a>
          </nav>
        </footer>
      </div>

      <OwnedSkillsSheet
        onClose={closeSheet}
        open={sheetOpen}
        openerRef={stackButtonRef}
      />
    </div>
  );
}
