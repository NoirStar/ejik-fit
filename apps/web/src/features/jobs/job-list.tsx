"use client";

import {
  ArrowSquareOut,
  BookmarkSimple,
  CheckCircle,
  MagnifyingGlass,
  ShieldCheck,
  StackSimple,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CompanyMark } from "@/features/home-feed/company-mark";
import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import { formatEmployment } from "@/lib/labels";
import type { PostingListResponse, PostingSummary } from "@/lib/types";

import {
  buildJobEvidence,
  buildJobsSummary,
  filterJobPostings,
  formatCareerRange,
  formatClosingDate,
  formatVerifiedDate,
  type JobView,
} from "./model";
import styles from "./job-list.module.css";

export type JobListFilters = {
  query: string;
  careerType: string;
};

type JobListProps = {
  postings: PostingListResponse | null;
  filters: JobListFilters;
  error?: boolean;
};

type SkillGroupProps = {
  label: string;
  skills: string[];
  tone: "required" | "preferred" | "mentioned";
};

function SkillGroup({ label, skills, tone }: SkillGroupProps) {
  if (skills.length === 0) return null;

  return (
    <div className={styles.skillGroup} data-tone={tone}>
      <h4>{label}</h4>
      <ul role="list">
        {skills.slice(0, 5).map((skill) => (
          <li key={skill}>
            <Link
              aria-label={`${skill} 스킬맵`}
              href={`/skill-map?skill=${encodeURIComponent(skill)}`}
            >
              {skill}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type JobItemProps = {
  job: PostingSummary;
  ownedSkills: string[];
  saved: boolean;
  onToggleSaved(id: string): void;
};

function JobItem({ job, ownedSkills, saved, onToggleSaved }: JobItemProps) {
  const evidence = buildJobEvidence(job, ownedSkills);
  const closingLabel = formatClosingDate(job.closes_at);

  return (
    <article className={styles.jobCard}>
      <header className={styles.jobHeader}>
        <CompanyMark
          companyName={job.company_name}
          size={52}
          sourceUrl={job.source_url}
        />
        <div className={styles.identity}>
          <p>{job.company_name}</p>
          <h3>
            <Link href={`/jobs/${encodeURIComponent(job.id)}`}>{job.title}</Link>
          </h3>
        </div>
        <button
          aria-label={`${job.title} ${saved ? "저장 해제" : "저장"}`}
          aria-pressed={saved}
          className={styles.saveButton}
          onClick={() => onToggleSaved(job.id)}
          type="button"
        >
          <BookmarkSimple
            aria-hidden="true"
            size={20}
            weight={saved ? "fill" : "regular"}
          />
        </button>
      </header>

      <dl className={styles.facts}>
        <div>
          <dt>경력</dt>
          <dd>{formatCareerRange(job)}</dd>
        </div>
        <div>
          <dt>고용</dt>
          <dd>{formatEmployment(job.employment_type)}</dd>
        </div>
        <div>
          <dt>근무지</dt>
          <dd>{job.location ?? "미기재"}</dd>
        </div>
        {closingLabel && (
          <div>
            <dt>접수</dt>
            <dd>{closingLabel}</dd>
          </div>
        )}
      </dl>

      {evidence.matchedSkills.length > 0 && (
        <div className={styles.matchEvidence}>
          <StackSimple aria-hidden="true" size={17} weight="bold" />
          <strong>내 기술과 겹침 {evidence.matchedSkills.length}개</strong>
          <span>{evidence.matchedSkills.join(" · ")}</span>
        </div>
      )}

      {evidence.extractedSkillCount > 0 ? (
        <div className={styles.skillEvidence}>
          <SkillGroup
            label="필수 기술"
            skills={evidence.requiredSkills}
            tone="required"
          />
          <SkillGroup
            label="우대 기술"
            skills={evidence.preferredSkills}
            tone="preferred"
          />
          <SkillGroup
            label="공고 언급"
            skills={evidence.unspecifiedSkills}
            tone="mentioned"
          />
        </div>
      ) : (
        <p className={styles.noEvidence}>
          확정 임계값을 통과한 기술 요구사항이 아직 없습니다.
        </p>
      )}

      <footer className={styles.jobFooter}>
        <span>
          <CheckCircle aria-hidden="true" size={16} weight="fill" />
          {formatVerifiedDate(job.last_verified_at)}
        </span>
        <div>
          <Link href={`/jobs/${encodeURIComponent(job.id)}`}>분석 보기</Link>
          <a href={job.source_url} rel="noreferrer" target="_blank">
            공식 원문
            <ArrowSquareOut aria-hidden="true" size={15} weight="bold" />
          </a>
        </div>
      </footer>
    </article>
  );
}

function ViewEmptyState({ view, hasOwnedSkills }: {
  view: JobView;
  hasOwnedSkills: boolean;
}) {
  if (view === "matched" && !hasOwnedSkills) {
    return (
      <div className={styles.emptyState}>
        <StackSimple aria-hidden="true" size={24} />
        <div>
          <h3>먼저 내 기술을 저장해 주세요.</h3>
          <p>브라우저에 저장한 기술과 확정된 공고 기술을 직접 비교합니다.</p>
        </div>
        <Link href="/career">내 커리어에서 기술 추가</Link>
      </div>
    );
  }
  if (view === "matched") {
    return (
      <div className={styles.emptyState}>
        <StackSimple aria-hidden="true" size={24} />
        <div>
          <h3>현재 결과에서 겹치는 기술이 없습니다.</h3>
          <p>검색 조건을 넓히거나 내 기술을 추가해 다시 확인해 보세요.</p>
        </div>
        <Link href="/career">내 기술 관리</Link>
      </div>
    );
  }
  return (
    <div className={styles.emptyState}>
      <BookmarkSimple aria-hidden="true" size={24} />
      <div>
        <h3>현재 결과에 저장한 공고가 없습니다.</h3>
        <p>공고 오른쪽의 저장 버튼을 누르면 이 브라우저에서 다시 볼 수 있습니다.</p>
      </div>
    </div>
  );
}

export function JobList({ postings, filters, error = false }: JobListProps) {
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<JobView>("all");
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const items = useMemo(() => postings?.items ?? [], [postings]);
  const filtering = Boolean(filters.query || filters.careerType);
  const summary = useMemo(() => buildJobsSummary(items), [items]);
  const matchingCount = useMemo(
    () => filterJobPostings(items, "matched", ownedSkills, savedIds).length,
    [items, ownedSkills, savedIds],
  );
  const savedCount = useMemo(
    () => filterJobPostings(items, "saved", ownedSkills, savedIds).length,
    [items, ownedSkills, savedIds],
  );
  const visibleJobs = useMemo(
    () => filterJobPostings(items, view, ownedSkills, savedIds),
    [items, ownedSkills, savedIds, view],
  );

  useEffect(() => {
    setOwnedSkills(readOwnedSkills());
    setSavedIds(readSavedJobIds());
    setHydrated(true);
    const unsubscribeOwned = subscribeOwnedSkills(setOwnedSkills);
    const unsubscribeSaved = subscribeSavedJobs(setSavedIds);
    return () => {
      unsubscribeOwned();
      unsubscribeSaved();
    };
  }, []);

  function handleToggleSaved(id: string) {
    setSavedIds(toggleSavedJob(id));
  }

  const resultAnnouncement = !hydrated
    ? "저장한 공고와 기술을 확인하고 있습니다."
    : `${visibleJobs.length}개 공고를 표시합니다.`;

  return (
    <main className={styles.main}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>검증된 공식 채용 데이터</p>
        <h1>공고 탐색</h1>
        <p className={styles.description}>
          기업 채용페이지의 공개 공고를 검색하고, 확정된 기술 요구사항과 내 기술의
          겹치는 근거를 확인하세요.
        </p>
        <ul className={styles.summary} aria-label="현재 공고 데이터 범위" role="list">
          <li>
            <strong>현재 결과 {summary.postingCount}건</strong>
            <span>최대 100건 응답</span>
          </li>
          <li>
            <strong>기업 {summary.companyCount}곳</strong>
            <span>현재 결과 기준</span>
          </li>
          <li>
            <strong>{summary.latestVerifiedLabel}</strong>
            <span>가장 최근 확인</span>
          </li>
        </ul>
      </header>

      <div aria-live="polite" className={styles.srOnly}>
        {resultAnnouncement}
      </div>

      <div className={styles.workspace}>
        <aside aria-labelledby="job-filter-title" className={styles.filterPanel}>
          <header>
            <p>탐색 기준</p>
            <h2 id="job-filter-title">검색 조건</h2>
          </header>
          <form action="/jobs" className={styles.filters} method="get">
            <div className={styles.field}>
              <label htmlFor="job-query">공고 검색</label>
              <div className={styles.searchField}>
                <MagnifyingGlass aria-hidden="true" size={18} />
                <input
                  defaultValue={filters.query}
                  id="job-query"
                  name="q"
                  placeholder="기술, 직무, 기업"
                  type="search"
                />
              </div>
            </div>
            <div className={styles.field}>
              <label htmlFor="career-type">경력 조건</label>
              <select
                defaultValue={filters.careerType}
                id="career-type"
                name="career_type"
              >
                <option value="">전체</option>
                <option value="new_comer">신입</option>
                <option value="experienced">경력</option>
                <option value="mixed">신입·경력</option>
              </select>
            </div>
            <button className={styles.searchButton} type="submit">
              검색
            </button>
            {filtering && (
              <Link className={styles.resetLink} href="/jobs">
                필터 초기화
              </Link>
            )}
          </form>
          <div className={styles.trustNote}>
            <ShieldCheck aria-hidden="true" size={19} weight="fill" />
            <p>
              지원 전 공식 원문에서 최신 조건을 확인해 주세요. 저장과 내 기술은 이
              브라우저에만 남습니다.
            </p>
            <Link href="/data-policy">데이터 정책</Link>
          </div>
        </aside>

        <section aria-labelledby="job-results-title" className={styles.results}>
          <header className={styles.resultHeader}>
            <div>
              <p>공식 원문 확인순</p>
              <h2 id="job-results-title">검색 결과</h2>
            </div>
            <span>{visibleJobs.length}개 표시</span>
          </header>

          <div aria-label="공고 보기" className={styles.viewTabs} role="group">
            <button
              aria-label={`전체 공고 ${items.length}`}
              aria-pressed={view === "all"}
              onClick={() => setView("all")}
              type="button"
            >
              전체 공고 <span>{items.length}</span>
            </button>
            <button
              aria-label={`내 기술 겹침 ${matchingCount}`}
              aria-pressed={view === "matched"}
              onClick={() => setView("matched")}
              type="button"
            >
              내 기술 겹침 <span>{matchingCount}</span>
            </button>
            <button
              aria-label={`저장한 공고 ${savedCount}`}
              aria-pressed={view === "saved"}
              onClick={() => setView("saved")}
              type="button"
            >
              저장한 공고 <span>{savedCount}</span>
            </button>
          </div>

          {error ? (
            <div className={styles.errorState} role="alert">
              <ShieldCheck aria-hidden="true" size={24} />
              <div>
                <h3>공고 데이터를 불러오지 못했습니다.</h3>
                <p>검색 조건은 유지했습니다. 잠시 뒤 다시 확인해 주세요.</p>
              </div>
              <nav aria-label="공고 오류 안내">
                <Link href="/jobs">다시 시도</Link>
                <Link href="/data-policy">데이터 정책 보기</Link>
              </nav>
            </div>
          ) : items.length === 0 ? (
            <div className={styles.emptyState}>
              <MagnifyingGlass aria-hidden="true" size={24} />
              <div>
                <h3>조건에 맞는 공식 공고가 없습니다.</h3>
                <p>검색어 또는 경력 조건을 조정해 주세요.</p>
              </div>
              <Link href="/jobs">전체 공고 보기</Link>
            </div>
          ) : visibleJobs.length === 0 ? (
            <ViewEmptyState
              hasOwnedSkills={ownedSkills.length > 0}
              view={view}
            />
          ) : (
            <ul className={styles.jobList} role="list">
              {visibleJobs.map((job) => (
                <li key={job.id}>
                  <JobItem
                    job={job}
                    onToggleSaved={handleToggleSaved}
                    ownedSkills={ownedSkills}
                    saved={savedIds.includes(job.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
