"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import styles from "@/app/trust-pages.module.css";
import { CompanyMark } from "@/features/home-feed/company-mark";
import type {
  SourceActivityStatus,
  SourceDirectoryItem,
  SourceDirectoryResponse,
} from "@/lib/types";
import {
  getSourceActivityCopy,
  getSourcePreparationCopy,
} from "@/lib/source-status";

const DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  dateStyle: "medium",
  timeZone: "Asia/Seoul",
});

type SourceStatusFilter = "all" | SourceActivityStatus;

const AUTO_REFRESH_INTERVAL_MS = 60_000;
const SOURCE_PAGE_SIZE = 24;

const STATUS_FILTERS: ReadonlyArray<{
  label: string;
  accessibleLabel: string;
  value: SourceStatusFilter;
}> = [
  { label: "전체", accessibleLabel: "전체 보기", value: "all" },
  {
    label: "공고 수집 정상",
    accessibleLabel: "공고 수집 정상만 보기",
    value: "active",
  },
  {
    label: "공개 공고 없음",
    accessibleLabel: "공개 공고 없음만 보기",
    value: "quiet",
  },
  {
    label: "점검 필요",
    accessibleLabel: "점검 필요만 보기",
    value: "attention",
  },
  {
    label: "연결 준비",
    accessibleLabel: "연결 준비만 보기",
    value: "preparing",
  },
];

const INITIAL_VISIBLE_COUNTS: Readonly<Record<SourceActivityStatus, number>> = {
  active: SOURCE_PAGE_SIZE,
  quiet: SOURCE_PAGE_SIZE,
  attention: SOURCE_PAGE_SIZE,
  preparing: SOURCE_PAGE_SIZE,
};

function normalizedSearchValue(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

function lastCollectedLabel(value: string | null) {
  if (!value) {
    return "최근 수집 시각 없음";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 시각 점검 중";
  return `${DATE_FORMATTER.format(date)} 수집`;
}

function SourceRow({ item }: { item: SourceDirectoryItem }) {
  const isConnected = item.collection_status === "collecting";
  const activity = getSourceActivityCopy(item.activity_status);
  const preparation = getSourcePreparationCopy(item.preparation_reason);
  const detail =
    item.activity_status === "preparing" ? preparation.detail : activity.detail;
  const lastCollected = lastCollectedLabel(item.last_success_at);

  return (
    <li className={styles.sourceRow}>
      <div className={styles.sourceIdentity}>
        <CompanyMark
          companyName={item.company_name}
          size={32}
          sourceUrl={item.careers_url}
        />
        <div>
          {isConnected ? (
            <Link
              aria-label={`${item.company_name} 공고 보기`}
              href={`/companies/${encodeURIComponent(item.company_slug)}`}
            >
              {item.company_name}
            </Link>
          ) : (
            <strong>{item.company_name}</strong>
          )}
          <small title={detail}>
            {isConnected ? `${detail} · ${lastCollected}` : detail}
          </small>
        </div>
      </div>
      <div className={styles.sourceMeta}>
        <span
          className={styles.collectionStatus}
          data-status={item.activity_status}
          data-reason={item.preparation_reason ?? undefined}
        >
          {activity.label}
        </span>
        {item.activity_status === "active" && (
          <span className={styles.openCount}>열린 공고 {item.open_postings}건</span>
        )}
        {item.activity_status === "preparing" && (
          <span className={styles.openCount}>{preparation.label}</span>
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
          aria-label={`${nextCount}개 기업 더 보기, 모두 표시하면 남은 기업 ${Math.max(0, remainingCount - nextCount)}개`}
          className={styles.sourceMoreButton}
          onClick={onShowMore}
          type="button"
        >
          {nextCount}개 더 보기
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
  const [visibleCounts, setVisibleCounts] = useState<
    Record<SourceActivityStatus, number>
  >(() => ({ ...INITIAL_VISIBLE_COUNTS }));
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
        item.activity_status !== statusFilter
      ) {
        return false;
      }
      return (
        normalizedQuery.length === 0 ||
        normalizedSearchValue(item.company_name).includes(normalizedQuery)
      );
    });
  }, [directory.items, query, statusFilter]);
  const active = filteredItems.filter(
    (item) => item.activity_status === "active",
  );
  const quiet = filteredItems.filter(
    (item) => item.activity_status === "quiet",
  );
  const attention = filteredItems.filter(
    (item) => item.activity_status === "attention",
  );
  const preparing = filteredItems.filter(
    (item) => item.activity_status === "preparing",
  );
  const activityCounts = directory.items.reduce(
    (counts, item) => {
      counts[item.activity_status] += 1;
      return counts;
    },
    { active: 0, quiet: 0, attention: 0, preparing: 0 },
  );

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setVisibleCounts({ ...INITIAL_VISIBLE_COUNTS });
  };

  const resetVisibleCounts = () => {
    setVisibleCounts({ ...INITIAL_VISIBLE_COUNTS });
  };

  const showMore = (status: SourceActivityStatus) => {
    setVisibleCounts((current) => ({
      ...current,
      [status]: current[status] + SOURCE_PAGE_SIZE,
    }));
  };

  return (
    <>
      <div aria-label="수집 현황" className={styles.directorySummary}>
        <span>정상 {activityCounts.active}개 기업</span>
        <span>공고 없음 {activityCounts.quiet}개 기업</span>
        <span>점검 필요 {activityCounts.attention}개 기업</span>
        <span>연결 준비 {activityCounts.preparing}개 기업</span>
        <span>열린 공고 {directory.open_postings}건</span>
        <span>서비스 반영 데이터 · 1분마다 갱신</span>
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
            description="최근 수집이 정상이며, 확인된 공개 공고를 서비스에 반영합니다."
            items={active}
            onShowMore={() => showMore("active")}
            title="공고 수집 정상"
            visibleCount={visibleCounts.active}
          />
          <SourceGroup
            description="최근 수집은 정상이며 현재 공식 채용페이지에 공개된 공고가 없습니다."
            items={quiet}
            onShowMore={() => showMore("quiet")}
            title="현재 공개 공고 없음"
            visibleCount={visibleCounts.quiet}
          />
          <SourceGroup
            description="최근 정상 수집 시각이 오래되어 다시 확인 중입니다. 공고 수를 0건으로 단정하지 않습니다."
            items={attention}
            onShowMore={() => showMore("attention")}
            title="수집 상태 점검 필요"
            visibleCount={visibleCounts.attention}
          />
          <SourceGroup
            description="연결 방식 또는 수집 정책을 더 확인 중이며, 공고 수에는 포함하지 않습니다."
            items={preparing}
            onShowMore={() => showMore("preparing")}
            title="연결 준비"
            visibleCount={visibleCounts.preparing}
          />
        </>
      ) : (
        <div className={styles.sourceEmpty} role="status">
          <strong>조건에 맞는 기업이 없습니다.</strong>
          <span>검색어나 수집 상태를 바꿔 주세요.</span>
          <button onClick={resetFilters} type="button">
            필터 초기화
          </button>
        </div>
      )}
    </>
  );
}
