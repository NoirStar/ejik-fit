"use client";

import {
  Bell,
  Briefcase,
  CaretDown,
  ChartLineUp,
  Graph,
  House,
  MagnifyingGlass,
  NotePencil,
  Stack,
  UserCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { OwnedSkillsSheet } from "@/features/owned-skills/owned-skills-sheet";
import {
  normalizeOwnedSkills,
  ownedSkillsToDashboardHref,
  readOwnedSkills,
  writeOwnedSkills,
} from "@/lib/owned-skills";

import styles from "./app-shell.module.css";

const NAV_ITEMS = [
  { href: "/", label: "홈", icon: House },
  { href: "/market", label: "시장", icon: ChartLineUp },
  { href: "/skill-map", label: "스킬맵", icon: Graph },
  { href: "/jobs", label: "공고", icon: Briefcase },
  { href: "/career", label: "내 커리어", mobileLabel: "내 정보", icon: UserCircle },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isEditingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

function sameSkills(left: string[], right: string[]) {
  return left.length === right.length && left.every((skill, index) => skill === right[index]);
}

function StoredSkillsSync() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedSearch = searchParams.toString();

  useEffect(() => {
    if (pathname !== "/") return;
    const querySkills = normalizeOwnedSkills(
      searchParams.getAll("owned_skills").flatMap((value) => value.split(",")),
    );
    const storedSkills = readOwnedSkills();

    if (querySkills.length > 0) {
      if (!sameSkills(querySkills, storedSkills)) writeOwnedSkills(querySkills);
      return;
    }
    if (storedSkills.length === 0) return;

    router.replace(ownedSkillsToDashboardHref(storedSkills, serializedSearch), {
      scroll: false,
    });
    router.refresh();
  }, [pathname, router, searchParams, serializedSearch]);

  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const stackButtonRef = useRef<HTMLButtonElement>(null);
  const notificationAnchorRef = useRef<HTMLDivElement>(null);
  const notificationButtonRef = useRef<HTMLButtonElement>(null);
  const userAnchorRef = useRef<HTMLDivElement>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const closeUtilityMenus = useCallback(() => {
    setNotificationOpen(false);
    setUserMenuOpen(false);
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (notificationOpen) notificationButtonRef.current?.focus();
        if (userMenuOpen) userButtonRef.current?.focus();
        closeUtilityMenus();
        return;
      }

      if (
        event.key === "/" &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !isEditingTarget(event.target)
      ) {
        event.preventDefault();
        searchInputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeUtilityMenus, notificationOpen, userMenuOpen]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (notificationOpen && !notificationAnchorRef.current?.contains(target)) {
        setNotificationOpen(false);
      }
      if (userMenuOpen && !userAnchorRef.current?.contains(target)) {
        setUserMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationOpen, userMenuOpen]);

  useEffect(() => {
    closeUtilityMenus();
  }, [closeUtilityMenus, pathname]);

  function handleSkillsChange(skills: string[]) {
    if (pathname === "/") {
      const currentSearch = typeof window === "undefined" ? "" : window.location.search;
      router.replace(ownedSkillsToDashboardHref(skills, currentSearch), { scroll: false });
    }
    router.refresh();
  }

  function openSkillsSheet() {
    closeUtilityMenus();
    setSheetOpen(true);
  }

  return (
    <div className={styles.shell}>
      <Suspense fallback={null}>
        <StoredSkillsSync />
      </Suspense>
      <header className={styles.header}>
        <div className={styles.utilityRow}>
          <Link aria-label="이직핏 홈" className={styles.brand} href="/">
            <BrandMark size="sm" />
          </Link>

          <form action="/jobs" className={styles.searchForm} role="search">
            <MagnifyingGlass aria-hidden="true" className={styles.searchIcon} size={19} />
            <input
              aria-label="통합 검색"
              name="q"
              placeholder="회사, 직무, 기술, 주제를 검색해보세요"
              ref={searchInputRef}
              type="search"
            />
            <kbd aria-hidden="true">/</kbd>
          </form>

          <div className={styles.utilities}>
            <Link aria-label="글쓰기" className={styles.writeButton} href="/?compose=1">
              <NotePencil aria-hidden="true" size={19} weight="bold" />
              <span>글쓰기</span>
            </Link>

            <button
              aria-label="내 스택 열기"
              className={styles.stackButton}
              onClick={openSkillsSheet}
              ref={stackButtonRef}
              type="button"
            >
              <Stack aria-hidden="true" size={20} />
              <span className={styles.utilityLabel}>내 스택</span>
            </button>

            <div className={styles.menuAnchor} ref={notificationAnchorRef}>
              <button
                aria-controls="notification-disclosure"
                aria-expanded={notificationOpen}
                aria-label="알림 열기"
                className={styles.iconButton}
                onClick={() => {
                  setUserMenuOpen(false);
                  setNotificationOpen((open) => !open);
                }}
                ref={notificationButtonRef}
                type="button"
              >
                <Bell aria-hidden="true" size={21} />
              </button>
              {notificationOpen && (
                <div
                  aria-label="알림"
                  className={styles.menu}
                  id="notification-disclosure"
                >
                  <div className={styles.menuHeader}>알림</div>
                  <div className={styles.emptyMenuItem}>
                    <strong>새 알림이 없습니다.</strong>
                    <span>저장한 기술과 관련된 소식이 생기면 알려드릴게요.</span>
                  </div>
                </div>
              )}
            </div>

            <div className={styles.menuAnchor} ref={userAnchorRef}>
              <button
                aria-controls="user-disclosure"
                aria-expanded={userMenuOpen}
                aria-label="사용자 메뉴 열기"
                className={styles.userButton}
                onClick={() => {
                  setNotificationOpen(false);
                  setUserMenuOpen((open) => !open);
                }}
                ref={userButtonRef}
                type="button"
              >
                <span className={styles.avatar}>
                  <UserCircle aria-hidden="true" size={26} weight="fill" />
                </span>
                <span className={styles.userLabel}>게스트</span>
                <CaretDown aria-hidden="true" className={styles.userCaret} size={14} />
              </button>
              {userMenuOpen && (
                <div aria-label="사용자 메뉴" className={styles.menu} id="user-disclosure">
                  <div className={styles.menuHeader}>
                    <strong>로그인 없이 둘러보는 중</strong>
                    <span>내 스택은 이 브라우저에만 저장됩니다.</span>
                  </div>
                  <Link href="/career" onClick={closeUtilityMenus}>
                    내 커리어
                  </Link>
                  <Link href="/data-policy" onClick={closeUtilityMenus}>
                    데이터 정책
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <nav aria-label="주요 탐색" className={styles.desktopNav}>
          <div className={styles.navInner}>
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
                  onClick={closeUtilityMenus}
                >
                  <Icon aria-hidden="true" size={18} weight={active ? "fill" : "regular"} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </header>

      <div
        className={styles.content}
        data-immersive={pathname.startsWith("/skills/graph") ? "true" : undefined}
      >
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

      <nav aria-label="모바일 주요 탐색" className={styles.mobileNav}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={styles.mobileNavItem}
              data-active={active ? "true" : undefined}
              href={item.href}
              key={item.href}
              onClick={closeUtilityMenus}
            >
              <Icon aria-hidden="true" size={21} weight={active ? "fill" : "regular"} />
              <span>{"mobileLabel" in item ? item.mobileLabel : item.label}</span>
            </Link>
          );
        })}
      </nav>

      <OwnedSkillsSheet
        onClose={closeSheet}
        onSkillsChange={handleSkillsChange}
        open={sheetOpen}
        openerRef={stackButtonRef}
      />
    </div>
  );
}
