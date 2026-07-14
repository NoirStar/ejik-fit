import Link from "next/link";

import {
  MARKET_CATEGORIES,
  MARKET_CAREER_FILTERS,
  buildMarketFilterHref,
  type MarketOverviewSnapshot,
} from "./model";
import styles from "./market-overview.module.css";

const CATEGORY_LABELS: Record<string, string> = {
  language: "언어",
  frontend: "프론트엔드",
  backend: "백엔드",
  infra: "인프라",
  data: "데이터",
  ai: "AI",
  security: "보안",
  game: "게임",
  robotics: "로보틱스",
  mobile: "모바일",
  design: "디자인",
  embedded: "임베디드",
  qa: "QA",
  tool: "도구",
};

function formatCount(value: number | null, unit: string) {
  return value === null ? "확인 불가" : `${value.toLocaleString("ko-KR")}${unit}`;
}

function formatVerifiedDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) {
    return null;
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function VerifiedTime({ value }: { value: string }) {
  const verifiedDate = formatVerifiedDate(value);

  if (!verifiedDate) {
    return <span className={styles.verified}>확인 시각 없음</span>;
  }

  return (
    <time className={styles.verified} dateTime={value}>
      {verifiedDate} 확인
    </time>
  );
}

export function MarketOverview({
  snapshot,
}: {
  snapshot: MarketOverviewSnapshot;
}) {
  const latestVerifiedLabel = snapshot.postingError
    ? "확인 불가"
    : (formatVerifiedDate(snapshot.latestVerifiedAt) ?? "확인 시각 없음");
  const marketUnavailable = Boolean(
    snapshot.postingError && snapshot.skillError,
  );
  const description = snapshot.category
    ? `${snapshot.categoryLabel} 기술이 확인된 공개 공고 안에서 함께 요구되는 기술 수요를 살펴보세요.`
    : "현재 공개 중인 공고에서 확인한 기술 수요를 기술 분야와 경력 조건별로 살펴보세요.";
  const selectedCareerLabel = MARKET_CAREER_FILTERS.find(
    (filter) => filter.value === snapshot.careerType,
  )?.label;
  const careerScopeLabel = snapshot.careerType
    ? `${selectedCareerLabel ?? snapshot.careerType} 조건`
    : "전체 경력";

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>공식 채용 데이터</p>
        <h1 className={styles.title}>채용 시장</h1>
        <p className={styles.description}>{description}</p>
        <span className={styles.badge}>
          현재 범위 · {snapshot.categoryLabel} · {careerScopeLabel}
        </span>
      </header>

      <section aria-labelledby="market-snapshot-title">
        <h2 className={styles.srOnly} id="market-snapshot-title">
          현재 시장 스냅샷
        </h2>
        <dl className={styles.metrics}>
          <div className={styles.metric}>
            <dt>확인 공고</dt>
            <dd>{formatCount(snapshot.postingTotal, "건")}</dd>
          </div>
          <div className={styles.metric}>
            <dt>확인 기술</dt>
            <dd>{formatCount(snapshot.skillTotal, "개")}</dd>
          </div>
          <div className={styles.metric}>
            <dt>최근 확인</dt>
            <dd>{latestVerifiedLabel}</dd>
          </div>
        </dl>
      </section>

      <section
        aria-labelledby="market-filters-title"
        className={styles.filterGroups}
      >
        <h2 className={styles.srOnly} id="market-filters-title">
          시장 범위 필터
        </h2>
        <div className={styles.filterGroup}>
          <h3>기술 분야</h3>
          <nav aria-label="기술 분야" className={styles.filters}>
            {MARKET_CATEGORIES.map((filter) => (
              <Link
                aria-current={
                  snapshot.category === filter.value ? "page" : undefined
                }
                className={styles.filter}
                href={buildMarketFilterHref(
                  snapshot.careerType,
                  filter.value,
                )}
                key={filter.value || "all"}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className={styles.filterGroup}>
          <h3>경력 조건</h3>
          <nav aria-label="경력 조건" className={styles.filters}>
            {MARKET_CAREER_FILTERS.map((filter) => (
              <Link
                aria-current={
                  snapshot.careerType === filter.value ? "page" : undefined
                }
                className={styles.filter}
                href={buildMarketFilterHref(filter.value, snapshot.category)}
                key={filter.value || "all"}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      {marketUnavailable ? (
        <section
          aria-labelledby="market-unavailable-title"
          className={styles.completeFailure}
          role="alert"
        >
          <h2 id="market-unavailable-title">
            시장 데이터를 불러오지 못했습니다.
          </h2>
          <p>잠시 후 다시 시도하거나 전체 공고를 확인해 주세요.</p>
          <div className={styles.methodLinks}>
            <Link
              className={styles.textLink}
              href={buildMarketFilterHref(
                snapshot.careerType,
                snapshot.category,
              )}
            >
              다시 시도
            </Link>
            <Link className={styles.textLink} href={snapshot.jobsBrowseHref}>
              전체 공고 보기
            </Link>
          </div>
        </section>
      ) : (
        <div className={styles.contentGrid}>
          <section aria-labelledby="skill-demand-title" className={styles.panel}>
            <header className={styles.sectionHeader}>
              <h2 id="skill-demand-title">기술 수요 순위</h2>
              <p>한 개 이상의 공개 공고에서 확인된 기술을 공고 수 기준으로 정렬했습니다.</p>
            </header>

            {snapshot.skillError ? (
              <div className={styles.state} role="alert">
                <h3>{snapshot.skillError}</h3>
                <p>공고 목록은 확인 가능한 범위에서 계속 제공합니다.</p>
                <Link
                  className={styles.textLink}
                  href={buildMarketFilterHref(
                    snapshot.careerType,
                    snapshot.category,
                  )}
                >
                  다시 시도
                </Link>
              </div>
            ) : snapshot.skills.length === 0 ? (
              <div className={styles.state}>
                <h3>이 조건에서 확인된 기술 수요가 없습니다.</h3>
                <p>전체 조건에서 현재 수집된 기술을 확인해 보세요.</p>
                <Link className={styles.textLink} href="/market">
                  전체 시장 보기
                </Link>
              </div>
            ) : (
              <ol className={styles.skillList} role="list">
                {snapshot.skills.map((skill, index) => (
                  <li className={styles.skillItem} key={skill.name}>
                    <div className={styles.skillIdentity}>
                      <span className={styles.rank} aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <Link
                          aria-label={`${skill.name} 스킬맵`}
                          className={styles.skillLink}
                          href={skill.skillHref}
                        >
                          {skill.name}
                        </Link>
                        <span className={styles.category}>
                          {CATEGORY_LABELS[skill.category] ?? skill.category}
                        </span>
                      </div>
                    </div>

                    <div className={styles.demand}>
                      <strong>{skill.postingCount.toLocaleString("ko-KR")}건</strong>
                      <span className={styles.bar} aria-hidden="true">
                        <span style={{ width: `${skill.relativeDemand}%` }} />
                      </span>
                      <span className={styles.counts}>
                        <span>필수 {skill.requiredCount.toLocaleString("ko-KR")}건</span>
                        <span>우대 {skill.preferredCount.toLocaleString("ko-KR")}건</span>
                        <span>
                          미분류 {skill.unspecifiedCount.toLocaleString("ko-KR")}건
                        </span>
                      </span>
                    </div>

                    <Link
                      aria-label={`${skill.name} 관련 공고`}
                      className={styles.jobsLink}
                      href={skill.jobsHref}
                    >
                      관련 공고
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <aside aria-labelledby="recent-jobs-title" className={styles.panel}>
            <header className={styles.sectionHeader}>
              <h2 id="recent-jobs-title">최근 확인 공고</h2>
              <p>공식 원문에서 현재 공개 상태를 다시 확인한 공고입니다.</p>
            </header>

            {snapshot.postingError ? (
              <div className={styles.state} role="alert">
                <h3>{snapshot.postingError}</h3>
                <p>기술 수요는 확인 가능한 범위에서 계속 제공합니다.</p>
                <Link
                  className={styles.textLink}
                  href={buildMarketFilterHref(
                    snapshot.careerType,
                    snapshot.category,
                  )}
                >
                  다시 시도
                </Link>
              </div>
            ) : snapshot.jobs.length === 0 ? (
              <div className={styles.state}>
                <h3>이 조건에서 확인된 공개 공고가 없습니다.</h3>
                <p>전체 공고에서 다른 경력 조건을 살펴보세요.</p>
                <Link className={styles.textLink} href={snapshot.jobsBrowseHref}>
                  전체 공고 보기
                </Link>
              </div>
            ) : (
              <>
                <ul className={styles.jobList} role="list">
                  {snapshot.jobs.map((job) => (
                    <li key={job.id}>
                      <Link className={styles.job} href={job.href}>
                        <span className={styles.company}>{job.companyName}</span>
                        <strong>{job.title}</strong>
                        <span className={styles.jobMeta}>
                          <span>{job.careerLabel}</span>
                          <span>{job.employmentLabel}</span>
                          <span>{job.location}</span>
                        </span>
                        <VerifiedTime value={job.verifiedAt} />
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  className={`${styles.textLink} ${styles.browseLink}`}
                  href={snapshot.jobsBrowseHref}
                >
                  조건에 맞는 전체 공고
                </Link>
              </>
            )}
          </aside>
        </div>
      )}

      <section aria-labelledby="market-method-title" className={styles.method}>
        <h2 id="market-method-title">데이터를 읽는 기준</h2>
        <p>
          {snapshot.category
            ? `${snapshot.categoryLabel} 분야의 확정 기술이 하나 이상 있는 공개 공고를 먼저 고른 뒤, 그 공고에서 함께 확인된 모든 기술을 집계합니다. `
            : "현재 공개 중인 전체 공고에서 확인된 기술을 집계합니다. "}
          공고는 현재 조건에서 API가 반환한 최대 100개를, 기술 순위는 공고 수
          상위 최대 30개를 기준으로 표시합니다. 필수와 우대는 공고에 명시된
          문구를 기준으로 구분하며, 현재 비교 기간 데이터가 없어 변화율은
          표시하지 않습니다.
        </p>
        <div className={styles.methodLinks}>
          <Link className={styles.textLink} href="/methodology">
            분석 방법
          </Link>
          <Link className={styles.textLink} href="/data-policy">
            데이터 정책
          </Link>
        </div>
      </section>
    </main>
  );
}
