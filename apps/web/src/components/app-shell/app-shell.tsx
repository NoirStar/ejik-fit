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
  SignIn,
  SignOut,
  Stack,
  UserCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode, RefObject } from "react";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { AuthViewerProvider } from "@/features/auth/auth-viewer-context";
import { useAccountStateSync } from "@/features/auth/use-account-state-sync";
import { useAuthViewer } from "@/features/auth/use-auth-viewer";
import { ActivityNotificationCenter } from "@/features/notifications/activity-notification-center";
import { OwnedSkillsSheet } from "@/features/owned-skills/owned-skills-sheet";
import {
  readCareerPreferences,
  writeCareerPreferences,
} from "@/lib/career-preferences";
import {
  hasHomeCareerPreferenceParams,
  homeContextFromUrlSearchParams,
  homeContextToDashboardHref,
} from "@/lib/home-context";
import {
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
  if (href === "/skill-map" && pathname.startsWith("/skills/graph")) return true;
  if (href === "/jobs" && pathname.startsWith("/companies/")) return true;
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

function StoredHomeContextSync() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const serializedSearch = searchParams.toString();

  useEffect(() => {
    if (pathname !== "/") return;
    const queryContext = homeContextFromUrlSearchParams(searchParams);
    const storedSkills = readOwnedSkills();
    const storedPreferences = readCareerPreferences();
    const hasSkillParams = searchParams.has("owned_skills");
    const hasPreferenceParams = hasHomeCareerPreferenceParams(searchParams);

    const ownedSkills = hasSkillParams
      ? queryContext.ownedSkills
      : storedSkills;
    const careerPreferences = hasPreferenceParams
      ? queryContext.careerPreferences
      : storedPreferences;

    if (hasSkillParams && !sameSkills(queryContext.ownedSkills, storedSkills)) {
      writeOwnedSkills(queryContext.ownedSkills);
    }
    if (
      hasPreferenceParams &&
      (queryContext.careerPreferences.careerCondition !==
        storedPreferences.careerCondition ||
        queryContext.careerPreferences.targetDomain !==
          storedPreferences.targetDomain)
    ) {
      writeCareerPreferences(queryContext.careerPreferences);
    }

    const nextHref = homeContextToDashboardHref(
      { ownedSkills, careerPreferences },
      serializedSearch,
    );
    const nextSearch = new URL(nextHref, "https://ejik.fit").searchParams.toString();
    if (nextSearch === serializedSearch) return;

    router.replace(nextHref, {
      scroll: false,
    });
    router.refresh();
  }, [pathname, router, searchParams, serializedSearch]);

  return null;
}

function HeaderSearchFormView({
  currentQuery,
  inputRef,
}: {
  currentQuery: string;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <form action="/search" className={styles.searchForm} role="search">
      <MagnifyingGlass aria-hidden="true" className={styles.searchIcon} size={19} />
      <input
        aria-label="통합 검색"
        defaultValue={currentQuery}
        key={currentQuery || "global-search-empty"}
        maxLength={200}
        name="q"
        placeholder="회사, 직무, 기술, 주제를 검색해보세요"
        ref={inputRef}
        type="search"
      />
      <kbd aria-hidden="true">/</kbd>
    </form>
  );
}

function HeaderSearchForm({
  inputRef,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentQuery =
    pathname === "/search" ? searchParams.get("q") ?? "" : "";

  return (
    <HeaderSearchFormView currentQuery={currentQuery} inputRef={inputRef} />
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [interactive, setInteractive] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const {
    viewer,
    ready,
    signingOut,
    error: authError,
    signOut,
  } = useAuthViewer();
  const accountSyncStatus = useAccountStateSync(viewer);
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
    setInteractive(true);
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
      router.replace(
        homeContextToDashboardHref(
          {
            ownedSkills: skills,
            careerPreferences: readCareerPreferences(),
          },
          currentSearch,
        ),
        { scroll: false },
      );
    }
    router.refresh();
  }

  function openSkillsSheet() {
    closeUtilityMenus();
    setSheetOpen(true);
  }

  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const viewerLabel = viewer?.email.split("@")[0] || "로그인";

  const shell = (
    <div className={styles.shell}>
      <Suspense fallback={null}>
        <StoredHomeContextSync />
      </Suspense>
      <header className={styles.header}>
        <div className={styles.utilityRow}>
          <Link aria-label="이직핏 홈" className={styles.brand} href="/">
            <BrandMark size="sm" />
          </Link>

          <Suspense
            fallback={
              <HeaderSearchFormView currentQuery="" inputRef={searchInputRef} />
            }
          >
            <HeaderSearchForm inputRef={searchInputRef} />
          </Suspense>

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

          <div className={styles.utilities}>
            <Link aria-label="글쓰기" className={styles.writeButton} href="/?compose=1">
              <NotePencil aria-hidden="true" size={19} weight="bold" />
              <span>글쓰기</span>
            </Link>

            <button
              aria-label="내 스택 열기"
              className={styles.stackButton}
              disabled={!interactive}
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
                disabled={!interactive}
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
                  <div className={styles.menuHeader}>
                    <strong>알림</strong>
                    <span>관심 기업의 새 공고와 저장·지원 현황을 보여드려요.</span>
                  </div>
                  <ActivityNotificationCenter onNavigate={closeUtilityMenus} />
                </div>
              )}
            </div>

            <div className={styles.menuAnchor} ref={userAnchorRef}>
              <button
                aria-controls="user-disclosure"
                aria-expanded={userMenuOpen}
                aria-label="사용자 메뉴 열기"
                className={styles.userButton}
                disabled={!interactive}
                onClick={() => {
                  setNotificationOpen(false);
                  setUserMenuOpen((open) => !open);
                }}
                ref={userButtonRef}
                type="button"
              >
                <span className={styles.avatar}>
                  {viewer ? (
                    <UserCircle aria-hidden="true" size={26} weight="fill" />
                  ) : (
                    <SignIn aria-hidden="true" size={20} weight="bold" />
                  )}
                </span>
                <span className={styles.userLabel}>{viewerLabel}</span>
                <CaretDown aria-hidden="true" className={styles.userCaret} size={14} />
              </button>
              {userMenuOpen && (
                <div aria-label="사용자 메뉴" className={styles.menu} id="user-disclosure">
                  <div className={styles.menuHeader}>
                    <strong>{viewer ? viewer.email : "로그인 없이 둘러보는 중"}</strong>
                    <span aria-live={viewer ? "polite" : undefined}>
                      {viewer
                        ? accountSyncStatus === "synced"
                          ? "내 스택·관심 기업·저장 공고가 동기화되었습니다."
                          : accountSyncStatus === "error"
                            ? "계정 데이터를 동기화하지 못했습니다."
                            : "내 커리어 정보를 동기화하고 있습니다."
                        : "내 스택은 현재 이 브라우저에만 저장됩니다."}
                    </span>
                  </div>
                  {!viewer && (
                    <Link
                      className={styles.loginAction}
                      href={loginHref}
                      onClick={closeUtilityMenus}
                    >
                      <SignIn aria-hidden="true" size={18} weight="bold" />
                      로그인
                    </Link>
                  )}
                  <Link href="/career/account" onClick={closeUtilityMenus}>
                    계정 및 동기화
                  </Link>
                  <Link href="/career" onClick={closeUtilityMenus}>
                    내 커리어
                  </Link>
                  <Link href="/career/saved" onClick={closeUtilityMenus}>
                    저장 보관함
                  </Link>
                  <Link href="/career/companies" onClick={closeUtilityMenus}>
                    관심 기업
                  </Link>
                  <Link href="/career/questions" onClick={closeUtilityMenus}>
                    내 질문
                  </Link>
                  <Link href="/data-policy" onClick={closeUtilityMenus}>
                    데이터 정책
                  </Link>
                  {viewer && (
                    <button
                      className={styles.menuAction}
                      disabled={signingOut}
                      onClick={async () => {
                        if (await signOut()) {
                          closeUtilityMenus();
                          router.refresh();
                        }
                      }}
                      type="button"
                    >
                      <SignOut aria-hidden="true" size={18} />
                      {signingOut ? "로그아웃 중" : "로그아웃"}
                    </button>
                  )}
                  {authError && <p className={styles.menuError} role="alert">{authError}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
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

  return (
    <AuthViewerProvider ready={ready} viewer={viewer}>
      {shell}
    </AuthViewerProvider>
  );
}
