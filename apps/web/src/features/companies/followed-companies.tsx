"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  BookmarkSimple,
  Buildings,
  Trash,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  accountStorageStatusCopy,
  useAuthViewerContext,
} from "@/features/auth/auth-viewer-context";
import { CompanyMark } from "@/features/home-feed/company-mark";
import {
  clearFollowedCompanies,
  readFollowedCompanySlugs,
  subscribeFollowedCompanies,
  toggleFollowedCompany,
} from "@/lib/followed-companies";
import { PRODUCT_TERMS } from "@/lib/labels";
import type {
  SourceDirectoryItem,
  SourceDirectoryResponse,
} from "@/lib/types";
import {
  getSourceActivityCopy,
  getSourcePreparationCopy,
} from "@/lib/source-status";

import styles from "./followed-companies.module.css";

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

function collectedLabel(value: string | null) {
  if (!value) return "첫 확인 준비 중…";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${PRODUCT_TERMS.lastChecked} 시각 점검 중…`;
  return `${PRODUCT_TERMS.lastChecked} ${DATE_FORMATTER.format(date)}`;
}

function FollowedCompanyRow({
  item,
  onRemove,
}: {
  item: SourceDirectoryItem;
  onRemove: () => void;
}) {
  const connected = item.collection_status === "collecting";
  const activity = getSourceActivityCopy(item.activity_status);
  const preparation = getSourcePreparationCopy(item.preparation_reason);

  return (
    <li className={styles.companyRow}>
      <CompanyMark
        companyName={item.company_name}
        size={42}
        sourceUrl={item.careers_url}
      />
      <div className={styles.companyIdentity}>
        <Link href={`/companies/${encodeURIComponent(item.company_slug)}`}>
          {item.company_name}
        </Link>
        <span>
          {connected ? collectedLabel(item.last_success_at) : preparation.detail}
        </span>
      </div>
      <div className={styles.companyStatus}>
        <strong>{activity.label}</strong>
        <span>
          {item.activity_status === "active"
            ? `열린 공고 ${item.open_postings}건 · ${activity.detail}`
            : activity.detail}
        </span>
      </div>
      <div className={styles.companyActions}>
        {connected && (
          <Link href={`/companies/${encodeURIComponent(item.company_slug)}`}>
            공고 보기
            <ArrowRight aria-hidden="true" size={15} weight="bold" />
          </Link>
        )}
        <a href={item.careers_url} rel="noreferrer" target="_blank">
          공식 출처
          <ArrowSquareOut aria-hidden="true" size={14} weight="bold" />
        </a>
        <button
          aria-label={`${item.company_name} 관심 기업에서 제거`}
          onClick={onRemove}
          type="button"
        >
          <Trash aria-hidden="true" size={16} />
        </button>
      </div>
    </li>
  );
}

function MissingCompanyRow({ slug, onRemove }: { slug: string; onRemove: () => void }) {
  return (
    <li className={styles.companyRow}>
      <span aria-hidden="true" className={styles.missingMark}>
        <Buildings size={22} />
      </span>
      <div className={styles.companyIdentity}>
        <strong>{slug}</strong>
        <span>저장한 기업</span>
      </div>
      <div className={styles.companyStatus}>
        <strong>현재 확인 목록에 없음</strong>
        <span>저장 상태는 유지하며, 공개 출처 목록이 복구되면 다시 연결합니다.</span>
      </div>
      <div className={styles.companyActions}>
        <button
          aria-label={`${slug} 관심 기업에서 제거`}
          onClick={onRemove}
          type="button"
        >
          <Trash aria-hidden="true" size={16} />
        </button>
      </div>
    </li>
  );
}

export function FollowedCompanies({
  directory,
  directoryUnavailable,
}: {
  directory: SourceDirectoryResponse | null;
  directoryUnavailable: boolean;
}) {
  const { accountSyncStatus, viewer } = useAuthViewerContext();
  const storageStatus = accountStorageStatusCopy(
    viewer ? accountSyncStatus : "local",
  );
  const [hydrated, setHydrated] = useState(false);
  const [followedSlugs, setFollowedSlugs] = useState<string[]>([]);
  const directoryBySlug = useMemo(
    () =>
      new Map(
        (directory?.items ?? []).map((item) => [item.company_slug, item]),
      ),
    [directory],
  );

  useEffect(() => {
    setFollowedSlugs(readFollowedCompanySlugs());
    setHydrated(true);
    return subscribeFollowedCompanies(setFollowedSlugs);
  }, []);

  function removeCompany(slug: string) {
    setFollowedSlugs(toggleFollowedCompany(slug));
  }

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/career">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        내 커리어로 돌아가기
      </Link>

      <header className={styles.intro}>
        <div>
          <p>내 커리어</p>
          <h1>관심 기업</h1>
          <span>
            관심 기업의 현재 열린 공고와 확인 상태를 관리합니다.
          </span>
        </div>
        <Link href="/data-policy">확인 중인 기업 보기</Link>
      </header>

      <section aria-labelledby="followed-company-list-title" className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <p>{storageStatus.label}</p>
            <h2 id="followed-company-list-title">저장한 기업</h2>
            {storageStatus.error && (
              <small className={styles.storageError} role="alert">
                {storageStatus.error}
              </small>
            )}
          </div>
          <div>
            <span>{followedSlugs.length}개</span>
            {followedSlugs.length > 0 && (
              <button
                onClick={() => setFollowedSlugs(clearFollowedCompanies())}
                type="button"
              >
                전체 삭제
              </button>
            )}
          </div>
        </header>

        {!hydrated ? (
          <div className={styles.state} role="status">
            <span className={styles.loadingMark} aria-hidden="true" />
            <div>
              <h3>관심 기업을 불러오는 중…</h3>
              <p>이 기기에 저장한 관심 기업을 확인합니다.</p>
            </div>
          </div>
        ) : followedSlugs.length === 0 ? (
          <div className={styles.state}>
            <BookmarkSimple aria-hidden="true" size={25} />
            <div>
              <h3>관심 기업이 없습니다.</h3>
              <p>공고에서 기업을 선택해 관심 기업으로 저장할 수 있습니다.</p>
            </div>
            <Link href="/jobs">
              공고에서 기업 보기
              <ArrowRight aria-hidden="true" size={16} weight="bold" />
            </Link>
          </div>
        ) : (
          <>
            {directoryUnavailable && (
              <p className={styles.directoryWarning} role="status">
                공식 확인 목록을 불러오지 못해 저장한 기업만 표시합니다. 저장
                상태는 유지됩니다.
              </p>
            )}
            <ul className={styles.companyList} role="list">
              {[...followedSlugs].reverse().map((slug) => {
                const item = directoryBySlug.get(slug);
                return item ? (
                  <FollowedCompanyRow
                    item={item}
                    key={slug}
                    onRemove={() => removeCompany(slug)}
                  />
                ) : (
                  <MissingCompanyRow
                    key={slug}
                    onRemove={() => removeCompany(slug)}
                    slug={slug}
                  />
                );
              })}
            </ul>
          </>
        )}
      </section>

      <p className={styles.scopeNote}>
        열린 공고 수는 대한민국 전체 채용시장이 아니라 이직핏이 확인한 기업 공식
        채용페이지 범위입니다. 공고를 확인하기 전인 기업은 공고 수에 포함하지 않습니다.
      </p>
    </main>
  );
}
