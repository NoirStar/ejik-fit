import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";

import { CompanyMark } from "@/features/home-feed/company-mark";

import type { MarketJob } from "./model";
import styles from "./market-overview.module.css";

function formatVerifiedDate(value: string) {
  if (Number.isNaN(Date.parse(value))) return "확인 시각 없음";
  return `${new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeZone: "Asia/Seoul",
  }).format(new Date(value))} 확인`;
}

export function RecentJobList({
  browseHref,
  error,
  jobs,
  selectedSkill,
}: {
  browseHref: string;
  error: string | null;
  jobs: readonly MarketJob[];
  selectedSkill: string;
}) {
  return (
    <section className={styles.sidePanel}>
      <header className={styles.sideHeader}>
        <div>
          <h2>{selectedSkill ? `${selectedSkill} 관련 최근 공고` : "최근 확인 공고"}</h2>
          <span>공식 원문 확인 기준</span>
        </div>
        <Link href={browseHref}>더보기</Link>
      </header>
      {error ? (
        <div className={styles.compactState} role="alert">
          <strong>{error}</strong>
          <p>기술 수요 데이터는 확인 가능한 범위에서 유지합니다.</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className={styles.compactState}>
          <strong>현재 불러온 범위에 관련 공고가 없습니다.</strong>
          <p>전체 공고 목록에서 선택한 기술을 다시 검색해 보세요.</p>
          <Link href={browseHref}>관련 공고 전체 보기</Link>
        </div>
      ) : (
        <ul className={styles.recentJobList} key={selectedSkill}>
          {jobs.map((job) => (
            <li key={job.id}>
              <Link aria-label={`${job.companyName} ${job.title}`} href={job.href}>
                <CompanyMark
                  companyName={job.companyName}
                  size={34}
                  sourceUrl={job.sourceUrl}
                />
                <span className={styles.recentJobCopy}>
                  <small>{job.companyName}</small>
                  <strong>{job.title}</strong>
                  <span>
                    {job.careerLabel} · {job.location} · {formatVerifiedDate(job.verifiedAt)}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className={styles.panelFootnote}>
        현재 페이지가 불러온 공식 공고 범위에서 최신순으로 표시합니다.
      </p>
    </section>
  );
}
