import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";

import { CompanyMark } from "@/features/home-feed/company-mark";

import type {
  MarketJob,
  MarketSkill,
  MarketSkillCombination,
} from "./model";
import styles from "./market-overview.module.css";

export function SelectedTechnologyEvidence({
  combinations,
  error,
  jobs,
  selected,
}: {
  combinations: readonly MarketSkillCombination[];
  error: string | null;
  jobs: readonly MarketJob[];
  selected: MarketSkill | undefined;
}) {
  if (!selected) return null;

  return (
    <section
      aria-label={`${selected.name} 시장 근거`}
      className={styles.evidencePanel}
      role="region"
    >
      <header className={styles.sideHeader}>
        <div>
          <h2>{selected.name}</h2>
          <span>선택 기술의 시장 근거</span>
        </div>
      </header>
      <dl className={styles.evidenceMetrics}>
        <div>
          <dt>명시 요구</dt>
          <dd>{selected.explicitCount.toLocaleString("ko-KR")}건</dd>
        </div>
        <div>
          <dt>필수</dt>
          <dd>{selected.requiredCount.toLocaleString("ko-KR")}건</dd>
        </div>
        <div>
          <dt>우대</dt>
          <dd>{selected.preferredCount.toLocaleString("ko-KR")}건</dd>
        </div>
        <div>
          <dt>구분 안 됨</dt>
          <dd>{selected.unspecifiedCount.toLocaleString("ko-KR")}건</dd>
        </div>
      </dl>

      {error ? (
        <div className={styles.compactState} role="alert">
          <strong>{error}</strong>
          <p>전체 시장 수요 수치는 계속 확인할 수 있습니다.</p>
        </div>
      ) : (
        <>
          <div className={styles.evidenceSection}>
            <h3>함께 확인된 기술</h3>
            {combinations.length > 0 ? (
              <ul className={styles.connectionList}>
                {combinations.map((combination) => {
                  const other = combination.skills.find(
                    (skill) =>
                      skill.toLocaleLowerCase("en-US") !==
                      selected.name.toLocaleLowerCase("en-US"),
                  );
                  return (
                    <li key={combination.id}>
                      <span>{other ?? combination.skills.join(" + ")}</span>
                      <b>함께 {combination.postingCount}건</b>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>현재 불러온 범위에서 반복 관계를 확인하지 못했습니다.</p>
            )}
          </div>

          <div className={styles.evidenceSection}>
            <h3>관련 공식 공고</h3>
            {jobs.length > 0 ? (
              <ul className={styles.recentJobList}>
                {jobs.map((job) => (
                  <li key={job.id}>
                    <Link
                      aria-label={`${job.companyName} ${job.title}`}
                      href={job.href}
                    >
                      <CompanyMark
                        companyName={job.companyName}
                        size={34}
                        sourceUrl={job.sourceUrl}
                      />
                      <span className={styles.recentJobCopy}>
                        <small>{job.companyName}</small>
                        <strong>{job.title}</strong>
                        <span>
                          {job.careerLabel} · {job.location}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" size={14} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p>현재 불러온 범위에 관련 공고가 없습니다.</p>
            )}
          </div>
        </>
      )}

      <div className={styles.evidenceActions}>
        <Link href={selected.jobsHref}>관련 공고 전체 보기</Link>
        <Link href={selected.skillHref}>내 스킬맵에서 보기</Link>
      </div>
      <p className={styles.panelFootnote}>
        함께 확인된 기술과 공고 예시는 현재 불러온 최대 100개 공식 공고
        기준입니다.
      </p>
    </section>
  );
}
