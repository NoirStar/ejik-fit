import Link from "next/link";

import type { DashboardSnapshot } from "./model";

import styles from "./dashboard-home.module.css";

export type DashboardHomeProps = {
  snapshot: DashboardSnapshot;
  resourceErrors: string[];
};

function formatVerifiedAt(value: string | null) {
  if (!value) return "확인 시각 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 시각 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Seoul",
  }).format(date);
}

function EmptyDashboard() {
  return (
    <section className={styles.emptyState}>
      <h2>내 스택부터 설정해 주세요</h2>
      <p>
        왼쪽 또는 하단 탐색의 내 스택을 열어 기술을 추가하면 공식 공고와
        인접 기술을 비교할 수 있습니다.
      </p>
    </section>
  );
}

function ErrorDashboard({ errors }: { errors: string[] }) {
  return (
    <section className={styles.errorState} role="alert">
      <h2>채용 데이터를 불러오지 못했습니다</h2>
      <p>잠시 뒤 다시 확인해 주세요. 오류를 샘플 데이터로 대체하지 않습니다.</p>
      {errors.length > 0 && (
        <ul>
          {errors.map((error) => <li key={error}>{error}</li>)}
        </ul>
      )}
      <div className={styles.errorActions}>
        <Link className={styles.primaryAction} href="/">다시 시도</Link>
        <Link href="/data-policy">데이터 정책 보기</Link>
      </div>
    </section>
  );
}

export function DashboardHome({ snapshot, resourceErrors }: DashboardHomeProps) {
  const verifiedAt = formatVerifiedAt(snapshot.lastVerifiedAt);

  return (
    <main className={styles.main}>
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.kicker}>공식 채용 데이터</p>
          <h1>오늘의 공식 채용 신호</h1>
          <p className={styles.intro}>
            공개된 기업 채용페이지를 기준으로 요구 기술과 연결 관계를 확인합니다.
          </p>
        </div>
        <div className={styles.verification}>
          <span>마지막 확인</span>
          <strong data-numeric>{verifiedAt}</strong>
          <Link href="/data-policy">수집 기준 확인</Link>
        </div>
      </header>

      {snapshot.status === "partial" && (
        <section className={styles.partialNotice} role="status">
          <div>
            <strong>일부 데이터를 불러오지 못했습니다</strong>
            <p>확인된 데이터만 표시하며 누락된 영역은 비워 둡니다.</p>
          </div>
          {resourceErrors.length > 0 && <span>{resourceErrors[0]}</span>}
        </section>
      )}

      <section aria-label="분석 범위" className={styles.trustStrip}>
        <div>
          <span>표시 공고</span>
          <strong data-numeric>{snapshot.displayedPostingCount}개</strong>
        </div>
        <div>
          <span>공식 출처</span>
          <strong data-numeric>{snapshot.displayedSourceCount}개 출처</strong>
        </div>
        <div>
          <span>선택 기술</span>
          <strong data-numeric>{snapshot.ownedSkills.length}개</strong>
        </div>
        <div>
          <span>일치 공고</span>
          <strong data-numeric>{snapshot.matchingPostingCount}개</strong>
        </div>
      </section>

      {snapshot.status === "error" ? (
        <ErrorDashboard errors={resourceErrors} />
      ) : snapshot.status === "empty" ? (
        <EmptyDashboard />
      ) : (
        <div className={styles.dashboardGrid}>
          <section className={styles.matchSummary}>
            <h2>내 스택 연결</h2>
            <p className={styles.largeNumber} data-numeric>
              {snapshot.matchingPostingCount}
            </p>
            <p>
              선택한 기술과 실제 요구 기술이 한 개 이상 겹치는 공고입니다.
              전체 채용 가능성을 뜻하지 않습니다.
            </p>
            {snapshot.ownedSkills.length > 0 ? (
              <ul aria-label="분석 기준 기술">
                {snapshot.ownedSkills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            ) : (
              <p className={styles.onboarding}>내 스택을 추가하면 일치 공고를 계산합니다.</p>
            )}
            <Link href="/methodology">일치도 계산 방식</Link>
          </section>

          <section className={styles.jobsSection}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>최근 확인한 공식 공고</h2>
                <p>API에서 확인된 공고를 최근 검증 순서로 표시합니다.</p>
              </div>
              <Link href="/jobs">전체 공고 보기</Link>
            </div>

            {snapshot.jobs.length === 0 ? (
              <p className={styles.sectionEmpty}>표시할 공식 공고가 없습니다.</p>
            ) : (
              <ul className={styles.jobList}>
                {snapshot.jobs.slice(0, 8).map((job) => (
                  <li key={job.id}>
                    <div className={styles.jobIdentity}>
                      <span>{job.companyName}</span>
                      <Link href={`/jobs/${encodeURIComponent(job.id)}`}>{job.title}</Link>
                    </div>
                    <div className={styles.jobMeta}>
                      <span>{job.location}</span>
                      <span>{job.careerLabel}</span>
                      <span>{job.lastVerifiedLabel} 확인</span>
                    </div>
                    <div className={styles.jobFit}>
                      <span>{snapshot.fitLabel}</span>
                      <strong data-numeric>
                        {job.matchScore === null ? "미계산" : `${job.matchScore}%`}
                      </strong>
                    </div>
                    <a
                      className={styles.sourceLink}
                      href={job.sourceUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      공식 원문
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.skillDemand}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>요구 기술 수요</h2>
                <p>분석된 공식 공고의 기술 언급 횟수입니다.</p>
              </div>
            </div>
            {snapshot.skillDemand.length === 0 ? (
              <p className={styles.sectionEmpty}>기술 수요 데이터를 확인하지 못했습니다.</p>
            ) : (
              <ol className={styles.demandList}>
                {snapshot.skillDemand.map((skill) => (
                  <li key={skill.label}>
                    <strong>{skill.label}</strong>
                    <span data-numeric>{skill.count}건</span>
                    <small data-numeric>
                      필수 {skill.requiredCount}건, 우대 {skill.preferredCount}건
                    </small>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className={styles.adjacentSkills}>
            <div className={styles.sectionHeader}>
              <div>
                <h2>함께 요구된 기술</h2>
                <p>내 스택과 같은 공고에서 확인된 연결 횟수입니다.</p>
              </div>
              <Link href="/skills/graph">기술 맵 열기</Link>
            </div>
            {snapshot.adjacentSkills.length === 0 ? (
              <p className={styles.sectionEmpty}>연결된 기술을 확인할 수 없습니다.</p>
            ) : (
              <ul className={styles.adjacentList}>
                {snapshot.adjacentSkills.map((skill) => (
                  <li key={skill.label}>
                    <span>{skill.label}</span>
                    <strong data-numeric>{skill.cooccurrenceCount}회</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
