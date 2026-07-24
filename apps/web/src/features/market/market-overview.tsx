"use client";

import { Info, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PRODUCT_TERMS } from "@/lib/labels";

import { MarketFilters } from "./market-filters";
import { MarketPulseSummary } from "./market-pulse-summary";
import {
  buildMarketFilterHref,
  buildSkillCombinations,
  jobsForSkill,
  sortMarketSkills,
  type MarketOverviewSnapshot,
  type MarketSort,
} from "./model";
import { SelectedTechnologyEvidence } from "./selected-technology-evidence";
import styles from "./market-overview.module.css";
import { TechnologyDemandChart } from "./technology-demand-chart";
import { TechnologyTrendPanel } from "./technology-trend-panel";
import { useMarketTrends } from "./use-market-trends";

function formatVerifiedDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "확인 시각 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function MarketOverview({
  snapshot,
}: {
  snapshot: MarketOverviewSnapshot;
}) {
  const topExplicitSkills = useMemo(
    () => sortMarketSkills(snapshot.skills, "explicit").slice(0, 3),
    [snapshot.skills],
  );
  const topCompanySkills = useMemo(
    () => sortMarketSkills(snapshot.skills, "companies").slice(0, 3),
    [snapshot.skills],
  );
  const [sort, setSort] = useState<MarketSort>("companies");
  const [selectedSkill, setSelectedSkill] = useState(
    topCompanySkills[0]?.name ?? "",
  );
  const effectiveSkill = snapshot.skills.some(
    (skill) => skill.name === selectedSkill,
  )
    ? selectedSkill
    : (topCompanySkills[0]?.name ?? "");
  const selected = snapshot.skills.find(
    (skill) => skill.name === effectiveSkill,
  );
  const orderedSkills = useMemo(
    () => sortMarketSkills(snapshot.skills, sort),
    [snapshot.skills, sort],
  );
  const trendSkills = useMemo(
    () =>
      orderedSkills.slice(0, 15).map(({ category, name }) => ({
        category,
        name,
      })),
    [orderedSkills],
  );
  const trend = useMarketTrends({
    availableSkills: trendSkills,
    selectedSkill: effectiveSkill,
  });
  const trendUnavailable =
    trendSkills.length === 0 && trend.resource.status === "idle";
  const recentJobs = useMemo(
    () => jobsForSkill(snapshot.jobs, effectiveSkill),
    [effectiveSkill, snapshot.jobs],
  );
  const combinations = useMemo(
    () => buildSkillCombinations(snapshot.jobs, 3, effectiveSkill),
    [effectiveSkill, snapshot.jobs],
  );
  const marketUnavailable = Boolean(
    snapshot.postingError && snapshot.skillError,
  );

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <h1>채용 시장 기술 동향</h1>
        <p>기업 채용공고에 많이 나온 기술과 최근 변화를 보여줍니다.</p>
      </header>

      <section aria-label="데이터 범위 안내" className={styles.dataNotice}>
        <Info aria-hidden="true" size={18} weight="duotone" />
        <div>
          <strong>기업 공식 채용 페이지 확인 범위</strong>
          <p>국내 전체 채용시장 통계가 아닙니다.</p>
        </div>
      </section>

      <MarketPulseSummary
        leader={topExplicitSkills[0]}
        postingTotal={snapshot.postingTotal}
        skillTotal={snapshot.skillTotal}
        trendResource={trend.resource}
        trendUnavailable={trendUnavailable}
        verifiedLabel={formatVerifiedDate(snapshot.latestVerifiedAt)}
      />

      <MarketFilters
        careerType={snapshot.careerType}
        category={snapshot.category}
        onSortChange={setSort}
        sort={sort}
      />

      {marketUnavailable ? (
        <section className={styles.completeFailure} role="alert">
          <WarningCircle aria-hidden="true" size={22} weight="duotone" />
          <div>
            <h2>시장 데이터를 불러오지 못했습니다.</h2>
            <p>잠시 후 다시 시도하거나 전체 공고를 확인해 주세요.</p>
          </div>
          <div className={styles.failureActions}>
            <Link
              href={buildMarketFilterHref(
                snapshot.careerType,
                snapshot.category,
              )}
            >
              다시 시도
            </Link>
            <Link href={snapshot.jobsBrowseHref}>전체 공고 보기</Link>
          </div>
        </section>
      ) : (
        <div className={styles.dashboardGrid}>
          <div className={styles.mainColumn}>
            {snapshot.skillError ? (
              <section className={styles.largeState} role="alert">
                <WarningCircle aria-hidden="true" size={22} weight="duotone" />
                <div>
                  <h3>{snapshot.skillError}</h3>
                </div>
              </section>
            ) : snapshot.skills.length === 0 ? (
              <section className={styles.largeState}>
                <div>
                  <h3>선택한 조건에 해당하는 기술 데이터가 없습니다.</h3>
                </div>
                <Link href="/market">필터 초기화</Link>
              </section>
            ) : (
              <TechnologyDemandChart
                onSelect={setSelectedSkill}
                selectedSkill={effectiveSkill}
                skills={snapshot.skills}
                sort={sort}
              />
            )}

          </div>

          <aside className={styles.sideColumn}>
            <TechnologyTrendPanel
              availableSkills={trendSkills}
              comparedSkills={trend.comparedSkills}
              filterIsActive={Boolean(
                snapshot.careerType || snapshot.category,
              )}
              onAddSkill={trend.addSkill}
              onRemoveSkill={trend.removeSkill}
              onRetry={trend.retry}
              relatedJobsAvailable={!snapshot.postingError}
              resource={trend.resource}
              trendUnavailable={trendUnavailable}
            />
            <SelectedTechnologyEvidence
              combinations={combinations}
              error={snapshot.postingError}
              jobs={recentJobs}
              selected={selected}
            />
          </aside>
        </div>
      )}

      <section aria-label="데이터를 읽는 기준" className={styles.methodNote}>
        <strong>데이터를 읽는 기준</strong>
        <p>
          순위는 기술을 요구한 기업 수를 먼저 봅니다. 막대와 주간 변화는 필수
          또는 우대로 명시된 공고 수를 기준으로 합니다.{" "}
          <span>
            공고에 기술은 나오지만 필수 또는 우대로 구분되어 있지 않은 경우입니다.
          </span>{" "}
          {PRODUCT_TERMS.unspecifiedRequirement}로 표시합니다. 막대는 1위와의
          상대적인 차이이며 시장점유율이 아닙니다.
        </p>
        <div>
          <Link href="/methodology">분석 방법</Link>
          <Link href="/data-policy">데이터 정책</Link>
        </div>
      </section>
    </main>
  );
}
