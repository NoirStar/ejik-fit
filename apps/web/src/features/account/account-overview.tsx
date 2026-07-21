"use client";

import {
  Bell,
  BookmarkSimple,
  Briefcase,
  Buildings,
  CloudArrowUp,
  LockKey,
  SignIn,
  SignOut,
  Stack,
  UserCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useAuthViewer } from "@/features/auth/use-auth-viewer";
import {
  EMPTY_ACCOUNT_CAREER_STATE,
  readBrowserAccountState,
  subscribeBrowserAccountState,
  type AccountCareerState,
} from "@/lib/account-state";

import { AccountControls } from "./account-controls";
import styles from "./account-overview.module.css";
import { ProfileEditor } from "./profile-editor";

type AccountSummaryItem = {
  href: string;
  icon: typeof Stack;
  label: string;
  value: string;
  description: string;
};

export function AccountOverview() {
  const { viewer, ready, signingOut, error, signOut } = useAuthViewer();
  const [careerState, setCareerState] = useState<AccountCareerState>(
    EMPTY_ACCOUNT_CAREER_STATE,
  );

  useEffect(() => {
    setCareerState(readBrowserAccountState());
    return subscribeBrowserAccountState(setCareerState);
  }, []);

  const applicationCount = Object.keys(careerState.applicationStages).length;
  const summary: AccountSummaryItem[] = [
    {
      href: "/career",
      icon: Stack,
      label: "내 기술",
      value: `${careerState.ownedSkills.length}개`,
      description: "기술 스택과 희망 조건",
    },
    {
      href: "/career/saved",
      icon: BookmarkSimple,
      label: "저장 공고",
      value: `${careerState.savedJobIds.length}건`,
      description: "다시 확인할 공식 공고",
    },
    {
      href: "/career/saved?scope=applications",
      icon: Briefcase,
      label: "지원 기록",
      value: `${applicationCount}건`,
      description: "직접 기록한 지원 단계",
    },
    {
      href: "/career/alerts",
      icon: Bell,
      label: "공고 알림",
      value: viewer ? "계정 저장" : "로그인 필요",
      description: "저장 검색과 새 공고",
    },
    {
      href: "/career/companies",
      icon: Buildings,
      label: "관심 기업",
      value: `${careerState.followedCompanySlugs.length}곳`,
      description: "팔로우한 채용 페이지",
    },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.pageHeader}>
        <span>내 정보</span>
        <h1>계정 및 동기화</h1>
        <p>로그인 상태와 기기 간에 이어지는 커리어 정보 범위를 확인합니다.</p>
      </header>

      <section aria-labelledby="account-status-title" className={styles.identityPanel}>
        <div className={styles.identityIcon}>
          <UserCircle aria-hidden="true" size={30} weight="fill" />
        </div>
        <div className={styles.identityCopy}>
          <h2 id="account-status-title">
            {!ready
              ? "로그인 상태를 확인하고 있어요"
              : viewer
                ? "계정 동기화 사용 중"
                : "로그인 없이 이용 중"}
          </h2>
          <p>
            {viewer
              ? "내 스택, 저장 공고, 지원 단계와 관심 기업을 비공개 계정 데이터로 관리합니다."
              : "로그인하면 현재 브라우저의 커리어 데이터를 계정에 병합합니다."}
          </p>
        </div>
        <div className={styles.identityAction}>
          {ready && viewer ? (
            <button
              disabled={signingOut}
              onClick={() => void signOut()}
              type="button"
            >
              <SignOut aria-hidden="true" size={17} />
              {signingOut ? "로그아웃 중" : "로그아웃"}
            </button>
          ) : ready ? (
            <Link href="/login?next=%2Fcareer%2Faccount">
              <SignIn aria-hidden="true" size={18} weight="bold" />
              이메일로 로그인
            </Link>
          ) : null}
        </div>
      </section>

      {error && <p className={styles.error} role="alert">{error}</p>}

      {viewer && <ProfileEditor viewer={viewer} />}

      <section aria-labelledby="account-data-title" className={styles.dataSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 id="account-data-title">내 커리어 데이터</h2>
            <p>현재 이 기기에 병합되어 있는 값을 기준으로 표시합니다.</p>
          </div>
          <span className={styles.scopeBadge} data-signed-in={viewer ? "true" : undefined}>
            {viewer ? (
              <CloudArrowUp aria-hidden="true" size={15} />
            ) : (
              <LockKey aria-hidden="true" size={15} />
            )}
            {viewer ? "계정 동기화 대상" : "브라우저 저장"}
          </span>
        </div>

        <div className={styles.summaryGrid}>
          {summary.map((item) => {
            const Icon = item.icon;
            return (
              <Link href={item.href} key={item.label}>
                <span className={styles.summaryIcon}>
                  <Icon aria-hidden="true" size={20} />
                </span>
                <span className={styles.summaryCopy}>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
                <b>{item.value}</b>
              </Link>
            );
          })}
        </div>
      </section>

      {viewer && <AccountControls viewer={viewer} />}

      <aside className={styles.privacyNotice}>
        <LockKey aria-hidden="true" size={20} />
        <div>
          <strong>
            {viewer
              ? "계정 커뮤니티 활동도 함께 보관합니다."
              : "비로그인 커뮤니티 활동은 브라우저에 먼저 보관합니다."}
          </strong>
          <p>
            {viewer
              ? "계정으로 작성한 글과 댓글, 공감·저장·팔로우는 서버에 저장됩니다. 이직핏 시작 글의 체험 활동과 최근 본 주제만 이 브라우저에 남습니다."
              : "직접 작성한 로컬 글과 그 글의 댓글·공감·저장은 로그인 후 계정으로 안전하게 옮깁니다. 이직핏 시작 글의 체험 활동은 서버로 전송하지 않습니다."}
          </p>
        </div>
        <Link href="/privacy">저장 범위 자세히 보기</Link>
      </aside>
    </main>
  );
}
