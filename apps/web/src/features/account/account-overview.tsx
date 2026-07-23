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

import {
  accountStorageStatusCopy,
  useAuthViewerContext,
} from "@/features/auth/auth-viewer-context";
import { useAuthViewer } from "@/features/auth/use-auth-viewer";
import {
  EMPTY_ACCOUNT_CAREER_STATE,
  readBrowserAccountState,
  subscribeBrowserAccountState,
  type AccountCareerState,
} from "@/lib/account-state";
import { PRODUCT_TERMS } from "@/lib/labels";

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
  const { viewer, ready, status, signingOut, error, signOut } = useAuthViewer();
  const { accountSyncStatus } = useAuthViewerContext();
  const storageStatus = accountStorageStatusCopy(
    viewer ? accountSyncStatus : "local",
  );
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
      label: PRODUCT_TERMS.ownedSkills,
      value: `${careerState.ownedSkills.length}개`,
      description: "저장한 기술과 희망 조건",
    },
    {
      href: "/career/saved",
      icon: BookmarkSimple,
      label: PRODUCT_TERMS.savedItems,
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
      value: viewer ? "계정에서 관리" : "로그인 필요",
      description: viewer ? "계정의 알림 조건과 새 공고" : "알림 조건과 새 공고",
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
        <span>내 커리어</span>
        <h1>계정</h1>
        <p>프로필과 커리어 데이터의 저장 범위를 관리합니다.</p>
      </header>

      <section aria-labelledby="account-status-title" className={styles.identityPanel}>
        <div className={styles.identityIcon}>
          <UserCircle aria-hidden="true" size={30} weight="fill" />
        </div>
        <div className={styles.identityCopy}>
          <h2 id="account-status-title">
            {!ready
              ? "로그인 상태를 불러오는 중…"
              : status === "error"
                ? "로그인 상태를 확인하지 못했습니다."
              : viewer
                ? "로그인됨"
                : "로그인 없이 이용 중"}
          </h2>
          <p>
            {viewer
              ? accountSyncStatus === "synced"
                ? "내 기술, 저장 목록, 지원 기록과 관심 기업을 이 기기와 계정에 저장합니다."
                : accountSyncStatus === "syncing"
                  ? "커리어 데이터는 이 기기에 저장되어 있고, 계정에 저장 중입니다."
                  : "커리어 데이터는 이 기기에 저장됩니다."
              : status === "error"
                ? "현재 이 기기의 데이터는 그대로 유지됩니다. 연결이 복구되면 로그인 상태를 다시 확인합니다."
              : "로그인하면 현재 이 기기의 커리어 데이터를 계정에 합칩니다."}
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
              {signingOut ? "로그아웃 중…" : "로그아웃"}
            </button>
          ) : status === "unauthenticated" ? (
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
            <p>
              {viewer
                ? accountSyncStatus === "synced"
                  ? "현재 이 기기와 계정에 저장된 값을 표시합니다."
                  : accountSyncStatus === "syncing"
                    ? "현재 이 기기에 저장된 값을 표시하며 계정에도 저장 중입니다."
                    : "현재 이 기기에 저장된 값을 표시합니다."
                : "현재 이 기기에 저장된 값을 표시합니다."}
            </p>
          </div>
          <span className={styles.scopeBadge} data-signed-in={viewer ? "true" : undefined}>
            {viewer ? (
              <CloudArrowUp aria-hidden="true" size={15} />
            ) : (
              <LockKey aria-hidden="true" size={15} />
            )}
            {storageStatus.label}
          </span>
        </div>

        {storageStatus.error && (
          <p className={styles.error} role="alert">
            {storageStatus.error}
          </p>
        )}

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
              : "커뮤니티 게시는 로그인 확인 뒤 진행합니다."}
          </strong>
          <p>
            {viewer
              ? "계정으로 작성한 글과 댓글, 공감·저장·팔로우는 계정에 보관합니다. 작성 중인 임시 글과 최근 본 주제만 현재 탭 또는 이 기기에 남습니다."
              : "게시 전 작성 내용은 현재 탭의 임시 글로만 보관합니다. 이전 버전에서 이 기기에 남긴 글은 별도 복구 대상으로 표시하고 로그인 후 계정 이전을 시도합니다."}
          </p>
        </div>
        <Link href="/privacy">저장 범위 자세히 보기</Link>
      </aside>
    </main>
  );
}
