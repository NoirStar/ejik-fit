import Link from "next/link";

import { formatCareer, formatEmployment } from "@/lib/labels";
import type { PostingListResponse } from "@/lib/types";

import styles from "./job-list.module.css";

export type JobListFilters = {
  query: string;
  careerType: string;
};

type JobListProps = {
  postings: PostingListResponse | null;
  filters: JobListFilters;
  error?: string | null;
};

function formatVerifiedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 시각 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

export function JobList({ postings, filters, error = null }: JobListProps) {
  const filtering = Boolean(filters.query || filters.careerType);

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <p>공식 채용 데이터</p>
        <h1>공고 탐색</h1>
        <span>기업 채용페이지에서 확인된 공고만 검색합니다.</span>
      </header>

      <form action="/jobs" className={styles.filters} method="get">
        <div className={styles.field}>
          <label htmlFor="job-query">공고 검색</label>
          <input
            defaultValue={filters.query}
            id="job-query"
            name="q"
            placeholder="기술, 직무, 기업 검색"
            type="search"
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="career-type">경력 조건</label>
          <select defaultValue={filters.careerType} id="career-type" name="career_type">
            <option value="">전체</option>
            <option value="new_comer">신입</option>
            <option value="experienced">경력</option>
            <option value="mixed">신입·경력</option>
          </select>
        </div>
        <button type="submit">검색</button>
        {filtering && <Link href="/jobs">필터 초기화</Link>}
      </form>

      <section aria-labelledby="job-results" className={styles.results}>
        <div className={styles.resultHeader}>
          <div>
            <h2 id="job-results">검색 결과</h2>
            <p>지원 전 공식 원문에서 최신 조건을 다시 확인해 주세요.</p>
          </div>
          <strong data-numeric>{postings?.total ?? 0}개 공고</strong>
        </div>

        {error ? (
          <div className={styles.error} role="alert">
            <h3>공고 데이터를 불러오지 못했습니다.</h3>
            {error !== "공고 데이터를 불러오지 못했습니다." && <p>{error}</p>}
            <div>
              <Link href="/jobs">다시 시도</Link>
              <Link href="/data-policy">데이터 정책 보기</Link>
            </div>
          </div>
        ) : postings && postings.items.length === 0 ? (
          <div className={styles.empty}>
            <h3>조건에 맞는 공식 공고가 없습니다.</h3>
            <p>검색어 또는 경력 조건을 조정해 주세요.</p>
            <Link href="/jobs">전체 공고 보기</Link>
          </div>
        ) : (
          <ul className={styles.list}>
            {(postings?.items ?? []).map((job) => (
              <li key={job.id}>
                <div className={styles.identity}>
                  <span>{job.company_name}</span>
                  <Link href={`/jobs/${encodeURIComponent(job.id)}`}>{job.title}</Link>
                </div>
                <dl className={styles.facts}>
                  <div>
                    <dt>근무지</dt>
                    <dd>{job.location ?? "미기재"}</dd>
                  </div>
                  <div>
                    <dt>경력</dt>
                    <dd>{formatCareer(job.career_type)}</dd>
                  </div>
                  <div>
                    <dt>고용 형태</dt>
                    <dd>{formatEmployment(job.employment_type)}</dd>
                  </div>
                </dl>
                <div className={styles.source}>
                  <span>{formatVerifiedAt(job.last_verified_at)} 확인</span>
                  <a href={job.source_url} rel="noreferrer" target="_blank">
                    공식 원문
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
