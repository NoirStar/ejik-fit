"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import styles from "@/app/trust-pages.module.css";
import { CompanyMark } from "@/features/home-feed/company-mark";
import type {
  SourceDirectoryItem,
  SourceDirectoryResponse,
} from "@/lib/types";
import { getSourcePreparationCopy } from "@/lib/source-status";

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

type SourceStatusFilter = "all" | SourceDirectoryItem["collection_status"];

const AUTO_REFRESH_INTERVAL_MS = 60_000;
const SOURCE_PAGE_SIZE = 24;

const STATUS_FILTERS: ReadonlyArray<{
  label: string;
  accessibleLabel: string;
  value: SourceStatusFilter;
}> = [
  { label: "전체", accessibleLabel: "전체 보기", value: "all" },
  { label: "수집 중", accessibleLabel: "수집 중만 보기", value: "collecting" },
  {
    label: "연결 준비",
    accessibleLabel: "연결 준비만 보기",
    value: "preparing",
  },
];

function normalizedSearchValue(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

function lastCollectedLabel(
  value: string | null,
  status: SourceDirectoryItem["collection_status"],
) {
  if (!value) {
    return status === "collecting" ? "최근 수집 시각 없음" : "첫 수집 준비 중";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 시각 점검 중";
  return `${DATE_FORMATTER.format(date)} 수집`;
}

function SourceRow({ item }: { item: SourceDirectoryItem }) {
  const isCollecting = item.collection_status === "collecting";
  const preparation = getSourcePreparationCopy(item.preparation_reason);

  return (
    <li className={styles.sourceRow}>
      <div className={styles.sourceIdentity}>
        <CompanyMark
          companyName={item.company_name}
          size={32}
          sourceUrl={item.careers_url}
        />
        <div>
          {isCollecting ? (
            <Link
              aria-label={`${item.company_name} 공고 보기`}
              href={`/companies/${encodeURIComponent(item.company_slug)}`}
            >
              {item.company_name}
            </Link>
          ) : (
            <strong>{item.company_name}</strong>
          )}
          <small title={isCollecting ? undefined : preparation.detail}>
            {isCollecting
              ? lastCollectedLabel(item.last_success_at, item.collection_status)
              : preparation.detail}
          </small>
        </div>
      </div>
      <div className={styles.sourceMeta}>
        <span
          className={styles.collectionStatus}
          data-status={item.collection_status}
          data-reason={item.preparation_reason ?? undefined}
        >
          {isCollecting ? "수집 중" : preparation.label}
        </span>
        {isCollecting && (
          <span className={styles.openCount}>열린 공고 {item.open_postings}건</span>
        )}
        <a
          aria-label={`${item.company_name} 공식 수집 출처`}
          href={item.careers_url}
          rel="noreferrer"
          target="_blank"
        >
          공식 출처 ↗
        </a>
      </div>
    </li>
  );
}

function SourceGroup({
  items,
  onShowMore,
  title,
  description,
  visibleCount,
}: {
  items: SourceDirectoryItem[];
  onShowMore: () => void;
  title: string;
  description: string;
  visibleCount: number;
}) {
  if (items.length === 0) return null;

  const visibleItems = items.slice(0, visibleCount);
  const remainingCount = Math.max(0, items.length - visibleItems.length);
  const nextCount = Math.min(SOURCE_PAGE_SIZE, remainingCount);

  return (
    <div className={styles.sourceGroup}>
      <div className={styles.sourceGroupHeading}>
        <h3>{title}</h3>
        <span>
          {visibleItems.length} / {items.length}개 기업
        </span>
        <p>{description}</p>
      </div>
      <ul className={styles.sourceList}>
        {visibleItems.map((item) => (
          <SourceRow item={item} key={item.company_slug} />
        ))}
      </ul>
      {remainingCount > 0 && (
        <button
          aria-label={`${nextCount}개 기업 더 보기`}
          className={styles.sourceMoreButton}
          onClick={onShowMore}
          type="button"
        >
          {nextCount}개 기업 더 보기
          <span>{remainingCount}개 남음</span>
        </button>
      )}
    </div>
  );
}

export function SourceDirectory({
  directory,
}: {
  directory: SourceDirectoryResponse;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<SourceStatusFilter>("all");
  const [visibleCounts, setVisibleCounts] = useState({
    collecting: SOURCE_PAGE_SIZE,
    preparing: SOURCE_PAGE_SIZE,
  });
  useEffect(() => {
    const refresh = () => router.refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(
      refreshWhenVisible,
      AUTO_REFRESH_INTERVAL_MS,
    );
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [router]);

  const filteredItems = useMemo(() => {
    const normalizedQuery = normalizedSearchValue(query.trim());
    return directory.items.filter((item) => {
      if (
        statusFilter !== "all" &&
        item.collection_status !== statusFilter
      ) {
        return false;
      }
      return (
        normalizedQuery.length === 0 ||
        normalizedSearchValue(item.company_name).includes(normalizedQuery)
      );
    });
  }, [directory.items, query, statusFilter]);
  const collecting = filteredItems.filter(
    (item) => item.collection_status === "collecting",
  );
  const preparing = filteredItems.filter(
    (item) => item.collection_status === "preparing",
  );

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setVisibleCounts({
      collecting: SOURCE_PAGE_SIZE,
      preparing: SOURCE_PAGE_SIZE,
    });
  };

  const resetVisibleCounts = () => {
    setVisibleCounts({
      collecting: SOURCE_PAGE_SIZE,
      preparing: SOURCE_PAGE_SIZE,
    });
  };

  const showMore = (status: SourceDirectoryItem["collection_status"]) => {
    setVisibleCounts((current) => ({
      ...current,
      [status]: current[status] + SOURCE_PAGE_SIZE,
    }));
  };

  return (
    <>
      <div aria-label="수집 출처 요약" className={styles.directorySummary}>
        <span>수집 중 {directory.collecting_count}개 기업</span>
        <span>연결 준비 {directory.preparing_count}개 기업</span>
        <span>열린 공고 {directory.open_postings}건</span>
        <span>운영 DB 기준 · 1분 자동 갱신</span>
      </div>

      <div className={styles.sourceToolbar}>
        <label className={styles.sourceSearch}>
          <span>회사명 검색</span>
          <input
            aria-label="수집 기업 검색"
            onChange={(event) => {
              setQuery(event.currentTarget.value);
              resetVisibleCounts();
            }}
            placeholder="회사명을 입력하세요"
            type="search"
            value={query}
          />
        </label>
        <div
          aria-label="수집 상태 필터"
          className={styles.sourceStatusFilters}
          role="group"
        >
          {STATUS_FILTERS.map((filter) => (
            <button
              aria-label={filter.accessibleLabel}
              aria-pressed={statusFilter === filter.value}
              key={filter.value}
              onClick={() => {
                setStatusFilter(filter.value);
                resetVisibleCounts();
              }}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>
        <span aria-live="polite" className={styles.sourceResultCount}>
          {filteredItems.length}개 결과
        </span>
      </div>

      {filteredItems.length > 0 ? (
        <>
          <SourceGroup
            description="정기 수집 대상이며, 확인된 열린 공고를 서비스에 반영하는 출처입니다."
            items={collecting}
            onShowMore={() => showMore("collecting")}
            title="현재 수집 중"
            visibleCount={visibleCounts.collecting}
          />
          <SourceGroup
            description="연결 방식 또는 수집 정책을 더 확인 중이며, 공고 수에는 포함하지 않습니다."
            items={preparing}
            onShowMore={() => showMore("preparing")}
            title="연결 준비 중"
            visibleCount={visibleCounts.preparing}
          />
        </>
      ) : (
        <div className={styles.sourceEmpty} role="status">
          <strong>조건에 맞는 기업이 없습니다.</strong>
          <span>회사명이나 수집 상태를 바꿔 다시 확인해보세요.</span>
          <button onClick={resetFilters} type="button">
            필터 초기화
          </button>
        </div>
      )}
    </>
  );
}
