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

import { CompanyMark } from "@/features/home-feed/company-mark";
import {
  clearFollowedCompanies,
  readFollowedCompanySlugs,
  subscribeFollowedCompanies,
  toggleFollowedCompany,
} from "@/lib/followed-companies";
import type {
  SourceDirectoryItem,
  SourceDirectoryResponse,
} from "@/lib/types";

import styles from "./followed-companies.module.css";

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

function collectedLabel(value: string | null) {
  if (!value) return "첫 수집 준비 중";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "최근 수집 시각 점검 중";
  return `${DATE_FORMATTER.format(date)} 최근 수집`;
}

function FollowedCompanyRow({
  item,
  onRemove,
}: {
  item: SourceDirectoryItem;
  onRemove: () => void;
}) {
  const collecting = item.collection_status === "collecting";

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
        <span>{collectedLabel(item.last_success_at)}</span>
      </div>
      <div className={styles.companyStatus}>
        <strong>{collecting ? `열린 공고 ${item.open_postings}건` : "연결 준비 중"}</strong>
        <span>
          {collecting
            ? "이직핏이 공식 채용페이지를 정기 확인합니다."
            : "공고 데이터는 아직 서비스 집계에 포함하지 않습니다."}
        </span>
      </div>
      <div className={styles.companyActions}>
        {collecting && (
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
        <span>저장한 기업 식별자</span>
      </div>
      <div className={styles.companyStatus}>
        <strong>현재 수집 목록에서 확인되지 않음</strong>
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
          <p>공식 채용페이지 다시 보기</p>
          <h1>관심 기업</h1>
          <span>
            저장한 기업의 현재 수집 상태와 열린 공고를 한곳에서 확인합니다.
          </span>
        </div>
        <Link href="/data-policy">전체 수집 기업 보기</Link>
      </header>

      <section aria-labelledby="followed-company-list-title" className={styles.panel}>
        <header className={styles.panelHeader}>
          <div>
            <p>브라우저 저장 · 로그인 시 동기화</p>
            <h2 id="followed-company-list-title">저장한 기업</h2>
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
              <h3>저장한 기업을 확인하고 있습니다.</h3>
              <p>이 브라우저의 관심 기업 목록을 읽고 있습니다.</p>
            </div>
          </div>
        ) : followedSlugs.length === 0 ? (
          <div className={styles.state}>
            <BookmarkSimple aria-hidden="true" size={25} />
            <div>
              <h3>아직 저장한 관심 기업이 없습니다.</h3>
              <p>공고에서 기업명을 열고 관심 기업으로 저장해 보세요.</p>
            </div>
            <Link href="/jobs">
              공고에서 기업 찾기
              <ArrowRight aria-hidden="true" size={16} weight="bold" />
            </Link>
          </div>
        ) : (
          <>
            {directoryUnavailable && (
              <p className={styles.directoryWarning} role="status">
                공식 수집 목록을 불러오지 못해 저장한 식별자만 표시합니다. 저장
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
        채용페이지 범위입니다. 연결 준비 중인 기업은 공고 수에 포함하지 않습니다.
      </p>
    </main>
  );
}
