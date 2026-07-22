"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type MouseEvent } from "react";

import {
  MARKET_CAREER_FILTERS,
  MARKET_CATEGORIES,
  buildMarketFilterHref,
  type MarketCareerType,
  type MarketSort,
} from "./model";
import type { SkillCategory } from "@/lib/skill-categories";
import styles from "./market-overview.module.css";

const SORT_OPTIONS: Array<{ value: MarketSort; label: string }> = [
  { value: "explicit", label: "명시 요구 많은 순" },
  { value: "demand", label: "전체 등장 많은 순" },
  { value: "required", label: "필수 요구 많은 순" },
  { value: "preferred", label: "우대 요구 많은 순" },
  { value: "name", label: "기술명 순" },
];

export function MarketFilters({
  careerType,
  category,
  onSortChange,
  sort,
}: {
  careerType: MarketCareerType;
  category: SkillCategory;
  onSortChange: (sort: MarketSort) => void;
  sort: MarketSort;
}) {
  const router = useRouter();
  const [isTransitionPending, startTransition] = useTransition();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const currentHref = buildMarketFilterHref(careerType, category);
  const isPending = isTransitionPending || pendingHref !== null;

  useEffect(() => {
    if (pendingHref === currentHref) {
      setPendingHref(null);
    }
  }, [currentHref, pendingHref]);

  function navigateFilter(
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    const opensElsewhere =
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.currentTarget.target === "_blank";

    if (event.defaultPrevented || opensElsewhere || href === currentHref) {
      return;
    }

    event.preventDefault();
    setPendingHref(href);
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  return (
    <section
      aria-busy={isPending || undefined}
      aria-label="시장 범위 필터"
      className={styles.filterPanel}
      data-pending={isPending}
    >
      {isPending ? (
        <span className={styles.srOnly} role="status">
          필터 결과를 업데이트하는 중입니다.
        </span>
      ) : null}
      <div className={styles.filterRow}>
        <strong>포함 기술 분야</strong>
        <nav aria-label="포함 기술 분야" className={styles.filters}>
          {MARKET_CATEGORIES.map((filter) => (
            <Link
              aria-current={category === filter.value ? "page" : undefined}
              className={styles.filter}
              href={buildMarketFilterHref(careerType, filter.value)}
              key={filter.value || "all"}
              onClick={(event) =>
                navigateFilter(
                  event,
                  buildMarketFilterHref(careerType, filter.value),
                )
              }
              prefetch={false}
              scroll={false}
            >
              {filter.value ? filter.label : "전체"}
            </Link>
          ))}
        </nav>
      </div>
      <p className={styles.filterHelp}>
        선택 분야 포함 공고의 모든 기술을 집계합니다.
      </p>
      <div className={styles.filterRow}>
        <strong>경력 조건</strong>
        <nav aria-label="경력 조건" className={styles.filters}>
          {MARKET_CAREER_FILTERS.map((filter) => (
            <Link
              aria-current={careerType === filter.value ? "page" : undefined}
              className={styles.filter}
              href={buildMarketFilterHref(filter.value, category)}
              key={filter.value || "all"}
              onClick={(event) =>
                navigateFilter(
                  event,
                  buildMarketFilterHref(filter.value, category),
                )
              }
              prefetch={false}
              scroll={false}
            >
              {filter.label}
            </Link>
          ))}
        </nav>
        <label className={styles.sortControl}>
          <span>정렬 기준</span>
          <select
            aria-label="기술 정렬 기준"
            onChange={(event) => onSortChange(event.target.value as MarketSort)}
            value={sort}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
