"use client";

import { Info, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { MarketFilters } from "./market-filters";
import { MarketFitInsight } from "./market-fit-insight";
import {
  buildMarketFilterHref,
  buildSkillCombinations,
  jobsForSkill,
  type MarketOverviewSnapshot,
  type MarketSort,
} from "./model";
import { RecentJobList } from "./recent-job-list";
import { SkillCombinationRecommendations } from "./skill-combination-recommendations";
import styles from "./market-overview.module.css";
import { TechnologyDemandChart } from "./technology-demand-chart";
import { TechnologyTrendPanel } from "./technology-trend-panel";
import { useMarketFit } from "./use-market-fit";

function formatVerifiedDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "확인 시각 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function Summary({ snapshot }: { snapshot: MarketOverviewSnapshot }) {
  const items = [
    {
      label: "확인된 공고",
      value: snapshot.postingCountLabel,
      detail: "현재 필터와 공식 공고 상태 기준",
    },
    {
      label: "확인된 기술",
      value:
        snapshot.skillTotal === null
          ? "확인 불가"
          : `${snapshot.skillTotal.toLocaleString("ko-KR")}종`,
      detail: "공식 공고에서 확인된 기술",
    },
    {
      label: "마지막 업데이트",
      value: formatVerifiedDate(snapshot.latestVerifiedAt),
      detail: "공고 원문 재확인 시각",
    },
    {
      label: "데이터 출처",
      value: "기업 공식 채용 홈페이지",
      detail: "직접 수집 및 분석",
    },
  ];

  return (
    <section aria-label="채용 시장 데이터 요약" className={styles.summaryPanel}>
      <dl>
        {items.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.value}</dd>
            <span>{item.detail}</span>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function MarketOverview({
  snapshot,
}: {
  snapshot: MarketOverviewSnapshot;
}) {
  const [sort, setSort] = useState<MarketSort>("demand");
  const [selectedSkill, setSelectedSkill] = useState(
    snapshot.skills[0]?.name ?? "",
  );
  const effectiveSkill = snapshot.skills.some(
    (skill) => skill.name === selectedSkill,
  )
    ? selectedSkill
    : (snapshot.skills[0]?.name ?? "");
  const selected = snapshot.skills.find(
    (skill) => skill.name === effectiveSkill,
  );
  const recentJobs = useMemo(
    () => jobsForSkill(snapshot.jobs, effectiveSkill),
    [effectiveSkill, snapshot.jobs],
  );
  const combinations = useMemo(
    () => buildSkillCombinations(snapshot.jobs, 3, effectiveSkill),
    [effectiveSkill, snapshot.jobs],
  );
  const fit = useMarketFit(snapshot.careerType);
  const marketUnavailable = Boolean(
    snapshot.postingError && snapshot.skillError,
  );

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <h1>채용 시장</h1>
        <p>기업 공식 채용 공고를 분석해 현재 기술 수요와 요구 조건을 확인합니다.</p>
      </header>

      <section aria-label="데이터 범위 안내" className={styles.dataNotice}>
        <Info aria-hidden="true" size={18} weight="duotone" />
        <div>
          <strong>이 데이터는 이직핏이 확인한 기업 공식 채용 공고 범위입니다.</strong>
          <p>
            국내 전체 채용시장을 의미하지 않습니다. 기업 공식 채용 페이지에서 수집한
            공고를 분석한 결과입니다.
          </p>
        </div>
      </section>

      <Summary snapshot={snapshot} />

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
                  <p>최근 공식 공고는 확인 가능한 범위에서 계속 제공합니다.</p>
                </div>
              </section>
            ) : snapshot.skills.length === 0 ? (
              <section className={styles.largeState}>
                <div>
                  <h3>선택한 조건에 해당하는 기술 데이터가 없습니다.</h3>
                  <p>전체 조건으로 돌아가 현재 수집된 기술 수요를 확인해 보세요.</p>
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

            <SkillCombinationRecommendations
              combinations={combinations}
              unavailable={Boolean(snapshot.postingError)}
            />
            <MarketFitInsight fit={fit} />
          </div>

          <aside className={styles.sideColumn}>
            <TechnologyTrendPanel
              availableSkills={snapshot.skills.slice(0, 15).map((skill) => ({
                category: skill.category,
                name: skill.name,
              }))}
              selectedSkill={effectiveSkill}
            />
            <RecentJobList
              browseHref={selected?.jobsHref ?? snapshot.jobsBrowseHref}
              error={snapshot.postingError}
              jobs={recentJobs}
              selectedSkill={effectiveSkill}
            />
          </aside>
        </div>
      )}

      <section aria-label="데이터를 읽는 기준" className={styles.methodNote}>
        <strong>데이터를 읽는 기준</strong>
        <p>
          기술별 숫자는 이직핏이 확인한 현재 공식 공고 수입니다. 요구 조건 막대는 각
          기술 안의 필수·우대·미분류 구성이며, 상대 수요 막대는 현재 필터의 1위 기술을
          기준으로만 비교합니다.
        </p>
        <div>
          <Link href="/methodology">분석 방법</Link>
          <Link href="/data-policy">데이터 정책</Link>
        </div>
      </section>
    </main>
  );
}
