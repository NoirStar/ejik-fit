import Link from "next/link";

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
  { value: "demand", label: "공고 수 많은 순" },
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
  return (
    <section aria-label="시장 범위 필터" className={styles.filterPanel}>
      <div className={styles.filterRow}>
        <strong>기술 분야</strong>
        <nav aria-label="기술 분야" className={styles.filters}>
          {MARKET_CATEGORIES.map((filter) => (
            <Link
              aria-current={category === filter.value ? "page" : undefined}
              className={styles.filter}
              href={buildMarketFilterHref(careerType, filter.value)}
              key={filter.value || "all"}
              scroll={false}
            >
              {filter.value ? filter.label : "전체"}
            </Link>
          ))}
        </nav>
      </div>
      <div className={styles.filterRow}>
        <strong>경력 조건</strong>
        <nav aria-label="경력 조건" className={styles.filters}>
          {MARKET_CAREER_FILTERS.map((filter) => (
            <Link
              aria-current={careerType === filter.value ? "page" : undefined}
              className={styles.filter}
              href={buildMarketFilterHref(filter.value, category)}
              key={filter.value || "all"}
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
