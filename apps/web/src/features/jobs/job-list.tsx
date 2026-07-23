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
import { SavedSearchComposer } from "@/features/saved-searches/saved-search-composer";
import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import { formatEmployment, PRODUCT_TERMS } from "@/lib/labels";
import { SKILL_CATEGORIES } from "@/lib/skill-categories";
import type { PostingListResponse, PostingSummary } from "@/lib/types";

import {
  buildJobEvidence,
  buildJobsSummary,
  filterJobPostings,
  formatCareerRange,
  formatClosingDate,
  formatDiscoveredDate,
  formatVerifiedDate,
  type JobView,
} from "./model";
import styles from "./job-list.module.css";

const JOB_COPY = {
  title: "채용공고",
  description: "기술·직무·기업으로 공고를 찾고 내 기술과 비교합니다.",
  currentList: "현재 목록",
  details: "기술 요건 보기",
  companyPage: "기업 채용페이지 보기",
  browseAll: "전체 공고 보기",
  filteredEmpty: "조건에 맞는 공고가 없습니다. 검색어나 필터를 줄여 주세요.",
  outOfRangeEmpty: "요청한 페이지는 공고 목록 범위를 벗어났습니다.",
  unfilteredEmpty: "현재 확인할 수 있는 공고가 없습니다.",
  savedEmpty: "저장한 공고가 없습니다.",
  addSkills: "내 기술을 추가하면 공고의 기술 요건과 비교합니다.",
} as const;

const SOURCE_NOTICE =
  "지원하기 전에 기업 채용페이지에서 최신 내용을 확인해 주세요.";

export type JobListFilters = {
  query: string;
  careerType: string;
  category: string;
};

type JobListProps = {
  postings: PostingListResponse | null;
  filters: JobListFilters;
  currentPage?: number;
  error?: boolean;
  initialView?: JobView;
  pageSize?: number;
  saveSearchRequested?: boolean;
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
              prefetch={false}
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
  const discoveredLabel = formatDiscoveredDate(job.first_seen_at);

  return (
    <article className={styles.jobCard}>
      <header className={styles.jobHeader}>
        <CompanyMark
          companyName={job.company_name}
          size={40}
          sourceUrl={job.source_url}
        />
        <div className={styles.identity}>
          <p>
            {job.company_slug ? (
              <Link
                aria-label={`${job.company_name} 기업 채용 현황`}
                className={styles.companyLink}
                href={`/companies/${encodeURIComponent(job.company_slug)}`}
                prefetch={false}
              >
                {job.company_name}
              </Link>
            ) : (
              job.company_name
            )}
          </p>
          <h3>
            <Link
              href={`/jobs/${encodeURIComponent(job.id)}`}
              prefetch={false}
            >
              {job.title}
            </Link>
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
            label={PRODUCT_TERMS.unspecifiedRequirement}
            skills={evidence.unspecifiedSkills}
            tone="mentioned"
          />
        </div>
      ) : (
        <p className={styles.noEvidence}>
          확인된 기술 요건이 없습니다.
        </p>
      )}

      <footer className={styles.jobFooter}>
        <span>
          <CheckCircle aria-hidden="true" size={16} weight="fill" />
          {discoveredLabel ?? formatVerifiedDate(job.last_verified_at)}
        </span>
        <div>
          <Link
            href={`/jobs/${encodeURIComponent(job.id)}`}
            prefetch={false}
          >
            {JOB_COPY.details}
          </Link>
          <a href={job.source_url} rel="noreferrer" target="_blank">
            {JOB_COPY.companyPage}
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
          <p>{JOB_COPY.addSkills}</p>
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
          <p>검색 조건을 넓히거나 내 기술을 추가해 주세요.</p>
        </div>
        <Link href="/career">내 기술 관리</Link>
      </div>
    );
  }
  return (
    <div className={styles.emptyState}>
      <BookmarkSimple aria-hidden="true" size={24} />
      <div>
        <h3>{JOB_COPY.savedEmpty}</h3>
        <p>공고를 저장하면 저장 목록에서 다시 볼 수 있습니다.</p>
      </div>
    </div>
  );
}

function paginationTokens(currentPage: number, pageCount: number) {
  const pages = new Set([
    1,
    pageCount,
    currentPage - 1,
    currentPage,
    currentPage + 1,
  ]);
  const ordered = [...pages]
    .filter((page) => page >= 1 && page <= pageCount)
    .sort((left, right) => left - right);
  const tokens: Array<number | "ellipsis"> = [];
  for (const page of ordered) {
    const previous = tokens[tokens.length - 1];
    if (typeof previous === "number" && page - previous > 1) {
      tokens.push("ellipsis");
    }
    tokens.push(page);
  }
  return tokens;
}

export function JobList({
  postings,
  filters,
  currentPage = 1,
  error = false,
  initialView = "all",
  pageSize = 20,
  saveSearchRequested = false,
}: JobListProps) {
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<JobView>(initialView);
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const items = useMemo(() => postings?.items ?? [], [postings]);
  const filtering = Boolean(
    filters.query || filters.category || filters.careerType,
  );
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
  const total = postings?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const pageStart = (currentPage - 1) * pageSize;
  const pageEnd = pageStart + items.length;
  const resultRangeLabel = view === "all"
    ? items.length
      ? `${pageStart + 1}-${pageEnd} / ${total}건`
      : `0 / ${total}건`
    : `${visibleJobs.length}건 · 현재 페이지`;

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

  useEffect(() => setView(initialView), [initialView]);

  function handleToggleSaved(id: string) {
    setSavedIds(toggleSavedJob(id));
  }

  const retryParams = new URLSearchParams();
  if (filters.query) retryParams.set("q", filters.query);
  if (filters.category) retryParams.set("category", filters.category);
  if (filters.careerType) retryParams.set("career_type", filters.careerType);
  if (currentPage > 1) retryParams.set("page", String(currentPage));
  if (view !== "all") retryParams.set("view", view);
  const retryQuery = retryParams.toString();
  const retryHref = `/jobs${retryQuery ? `?${retryQuery}` : ""}`;
  const resultAnnouncement = !hydrated
    ? "저장한 공고와 내 기술을 확인하고 있습니다."
    : visibleJobs.length
      ? view === "all"
        ? `전체 ${total}개 공고 중 ${pageStart + 1}번부터 ${pageEnd}번까지 표시합니다.`
        : `현재 페이지에서 ${visibleJobs.length}개 공고를 표시합니다.`
      : "표시할 공고가 없습니다.";
  const emptyCopy = filtering
    ? { description: null, title: JOB_COPY.filteredEmpty }
    : currentPage > 1
      ? {
          description: "첫 페이지에서 전체 공고를 확인해 주세요.",
          title: JOB_COPY.outOfRangeEmpty,
        }
      : { description: null, title: JOB_COPY.unfilteredEmpty };

  function selectView(nextView: JobView) {
    setView(nextView);
  }

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.category) params.set("category", filters.category);
    if (filters.careerType) params.set("career_type", filters.careerType);
    if (view !== "all") params.set("view", view);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/jobs${query ? `?${query}` : ""}`;
  }

  return (
    <main className={styles.main}>
      <header className={styles.intro}>
        <h1>{JOB_COPY.title}</h1>
        <p className={styles.description}>{JOB_COPY.description}</p>
        <ul className={styles.summary} aria-label="현재 공고 데이터 범위" role="list">
          {error ? (
            <>
              <li>
                <strong>공고 집계 불가</strong>
                <span>채용공고 데이터를 확인할 수 없습니다</span>
              </li>
              <li>
                <strong>기업 집계 불가</strong>
                <span>현재 결과 없음 아님</span>
              </li>
              <li>
                <strong>확인일 확인 불가</strong>
                <span>복구 후 다시 표시</span>
              </li>
            </>
          ) : (
            <>
              <li>
                <strong>전체 공식 공고 {total.toLocaleString("ko-KR")}건</strong>
                <span>{filtering ? "현재 검색 조건" : "이직핏 확인 범위"}</span>
              </li>
              <li>
                <strong>{JOB_COPY.currentList}</strong>
                <span>{summary.companyCount}개 기업 · {items.length}개 공고</span>
              </li>
              <li>
                <strong>{summary.latestVerifiedLabel}</strong>
                <span>{PRODUCT_TERMS.lastChecked}</span>
              </li>
            </>
          )}
        </ul>
      </header>

      {!error && (
        <div aria-live="polite" className={styles.srOnly}>
          {resultAnnouncement}
        </div>
      )}

      <div className={styles.workspace}>
        <aside aria-labelledby="job-filter-title" className={styles.filterPanel}>
          <header>
            <p>탐색 기준</p>
            <h2 id="job-filter-title">검색 조건</h2>
          </header>
          <form
            action="/jobs"
            className={styles.filters}
            key={retryQuery || "all-jobs"}
            method="get"
          >
            {view !== "all" && <input name="view" type="hidden" value={view} />}
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
              <label htmlFor="skill-category">기술 분야</label>
              <select
                defaultValue={filters.category}
                id="skill-category"
                name="category"
              >
                {SKILL_CATEGORIES.map((category) => (
                  <option key={category.value || "all"} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
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
            <div className={styles.filterActions}>
              <button className={styles.searchButton} type="submit">
                검색
              </button>
              {filtering && (
                <Link
                  className={styles.resetLink}
                  href="/jobs"
                  prefetch={false}
                >
                  {JOB_COPY.browseAll}
                </Link>
              )}
            </div>
          </form>
          <div className={styles.savedSearchComposer}>
            <SavedSearchComposer
              filters={filters}
              openOnReady={saveSearchRequested}
            />
          </div>
        </aside>

        <section
          aria-labelledby="job-results-title"
          className={styles.results}
        >
          <header className={styles.resultHeader}>
            <div>
              <p>
                {error
                  ? "공식 원문 데이터"
                  : filtering
                    ? "검색 조건에 맞는 공고"
                    : "여러 기업의 최근 공고"}
              </p>
              <h2 id="job-results-title">검색 결과</h2>
            </div>
            <span>{error ? "표시 불가" : resultRangeLabel}</span>
          </header>

          {!error && (
            <div aria-label="공고 보기" className={styles.viewTabs} role="group">
              <button
                aria-label={`전체 공고 ${total}`}
                aria-pressed={view === "all"}
                onClick={() => selectView("all")}
                type="button"
              >
                전체 <span>{total}</span>
              </button>
              <button
                aria-label={`내 기술 겹침 ${matchingCount}`}
                aria-pressed={view === "matched"}
                onClick={() => selectView("matched")}
                type="button"
              >
                기술 일치 <span>{matchingCount}</span>
              </button>
              <button
                aria-label={`${PRODUCT_TERMS.savedItems} ${savedCount}`}
                aria-pressed={view === "saved"}
                onClick={() => selectView("saved")}
                type="button"
              >
                저장 <span>{savedCount}</span>
              </button>
            </div>
          )}

          {error ? (
            <div className={styles.errorState} role="alert">
              <ShieldCheck aria-hidden="true" size={24} />
              <div>
                <h3>공고 데이터를 불러오지 못했습니다.</h3>
                <p>검색 조건은 유지했습니다. 잠시 뒤 다시 확인해 주세요.</p>
              </div>
              <nav aria-label="공고 오류 안내">
                <Link href={retryHref}>다시 시도</Link>
                <Link href="/data-policy">데이터 정책 보기</Link>
              </nav>
            </div>
          ) : items.length === 0 ? (
            <div className={styles.emptyState}>
              <MagnifyingGlass aria-hidden="true" size={24} />
              <div>
                <h3>{emptyCopy.title}</h3>
                {emptyCopy.description && <p>{emptyCopy.description}</p>}
              </div>
              <Link href="/jobs">{JOB_COPY.browseAll}</Link>
            </div>
          ) : visibleJobs.length === 0 ? (
            <ViewEmptyState
              hasOwnedSkills={ownedSkills.length > 0}
              view={view}
            />
          ) : (
            <>
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
              {pageCount > 1 && (
                <nav aria-label="공고 페이지" className={styles.pagination}>
                  {currentPage === 1 ? (
                    <span aria-disabled="true">이전</span>
                  ) : (
                    <Link
                      aria-label="이전 페이지"
                      href={pageHref(currentPage - 1)}
                      prefetch={false}
                    >
                      이전
                    </Link>
                  )}
                  <div>
                    {paginationTokens(currentPage, pageCount).map((token, index) =>
                      token === "ellipsis" ? (
                        <span
                          aria-hidden="true"
                          className={styles.paginationEllipsis}
                          key={`ellipsis-${index}`}
                        >
                          …
                        </span>
                      ) : token === currentPage ? (
                        <span
                          aria-current="page"
                          aria-label={`${token}페이지`}
                          key={token}
                        >
                          {token}
                        </span>
                      ) : (
                        <Link
                          aria-label={`${token}페이지`}
                          href={pageHref(token)}
                          key={token}
                          prefetch={false}
                        >
                          {token}
                        </Link>
                      ),
                    )}
                  </div>
                  {currentPage === pageCount ? (
                    <span aria-disabled="true">다음</span>
                  ) : (
                    <Link
                      aria-label="다음 페이지"
                      href={pageHref(currentPage + 1)}
                      prefetch={false}
                    >
                      다음
                    </Link>
                  )}
                </nav>
              )}
              <div className={styles.sourceNotice}>
                <ShieldCheck aria-hidden="true" size={18} weight="fill" />
                <p>{SOURCE_NOTICE}</p>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
