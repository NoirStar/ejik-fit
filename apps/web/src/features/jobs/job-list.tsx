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
  buildCareerAnalysis,
} from "@/features/career-analysis/model";
import {
  EMPTY_CAREER_PROFILE,
  readCareerProfile,
  subscribeCareerProfile,
  type CareerProfile,
} from "@/lib/career-profile";
import {
  readOwnedSkills,
  subscribeOwnedSkills,
} from "@/lib/owned-skills";
import {
  readSavedJobIds,
  subscribeSavedJobs,
  toggleSavedJob,
} from "@/lib/saved-jobs";
import { formatEmployment, formatLocation } from "@/lib/labels";
import { SKILL_CATEGORIES } from "@/lib/skill-categories";
import type { PostingListResponse, PostingSummary } from "@/lib/types";

import {
  buildJobEvidence,
  buildJobConnection,
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
  analysisPostings?: PostingSummary[];
  initialDirection?: string;
  analysisError?: boolean;
};

type JobItemProps = {
  job: PostingSummary;
  ownedSkills: string[];
  profile: CareerProfile;
  saved: boolean;
  onToggleSaved(id: string): void;
};

function JobItem({ job, ownedSkills, profile, saved, onToggleSaved }: JobItemProps) {
  const evidence = buildJobEvidence(job, ownedSkills);
  const connection = buildJobConnection(job, ownedSkills, profile);
  const closingLabel = formatClosingDate(job.closes_at);
  const conditions = [
    ...evidence.requiredSkills.slice(0, 2).map((skill) => ({
      label: skill,
      type: "필수",
    })),
    ...evidence.preferredSkills.slice(0, 1).map((skill) => ({
      label: skill,
      type: "우대",
    })),
    ...evidence.unspecifiedSkills.slice(0, 1).map((skill) => ({
      label: skill,
      type: "조건",
    })),
  ].slice(0, 3);

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
          <dd>{formatLocation(job.location)}</dd>
        </div>
        {closingLabel && (
          <div>
            <dt>접수</dt>
            <dd>{closingLabel}</dd>
          </div>
        )}
      </dl>

      <section
        aria-label={`${job.title} 추천 근거`}
        className={styles.matchEvidence}
      >
          <StackSimple aria-hidden="true" size={17} weight="bold" />
          <div>
            <strong>
              {connection.directionLabel
                ? connection.directionLabel + " · " + connection.label
                : connection.label}
            </strong>
            <p>{connection.reason}</p>
            {connection.matchedSkills.length > 0 ? (
              <span>겹치는 기술: {connection.matchedSkills.join(" · ")}</span>
            ) : null}
            {connection.unconfirmedRequiredSkills.length > 0 &&
            connection.recommendationEligible ? (
              <small>
                현재 프로필에서 확인되지 않은 필수 조건:{" "}
                {connection.unconfirmedRequiredSkills.slice(0, 3).join(" · ")}
                {connection.unconfirmedRequiredSkills.length > 3 ? " 외" : ""}
              </small>
            ) : null}
          </div>
      </section>

      {conditions.length > 0 ? (
        <ul aria-label="핵심 기술 조건" className={styles.conditionList}>
          {conditions.map((condition) => (
            <li key={condition.type + condition.label}>
              <span>{condition.type}</span>
              {condition.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.noEvidence}>
          채용공고 내용에서 구분해 표시할 기술 조건을 확인하지 못했습니다.
        </p>
      )}

      <footer className={styles.jobFooter}>
        <span>
          <CheckCircle aria-hidden="true" size={16} weight="fill" />
          {formatVerifiedDate(job.last_verified_at)}
        </span>
        <div>
          <Link
            href={`/jobs/${encodeURIComponent(job.id)}`}
            prefetch={false}
          >
            공고 근거와 내용 보기
          </Link>
          <a href={job.source_url} rel="noreferrer" target="_blank">
            공식 채용 페이지에서 지원
            <ArrowSquareOut aria-hidden="true" size={15} weight="bold" />
          </a>
        </div>
      </footer>
    </article>
  );
}

function ViewEmptyState({ view, hasProfile }: {
  view: JobView;
  hasProfile: boolean;
}) {
  if (view === "matched" && !hasProfile) {
    return (
      <div className={styles.emptyState}>
        <StackSimple aria-hidden="true" size={24} />
        <div>
          <h3>먼저 커리어 프로필을 입력해 주세요.</h3>
          <p>현재 직무나 기술을 입력하면 채용공고와 연결되는 근거를 비교합니다.</p>
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
          <h3>현재 조건에서 추천 근거가 충분한 공고가 없습니다.</h3>
          <p>검색 조건을 넓히거나 주요 업무와 경력 정보를 확인해 주세요.</p>
        </div>
        <Link href="/career">프로필 정보 확인</Link>
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
  pageSize = 12,
  saveSearchRequested = false,
  analysisPostings = [],
  initialDirection = "",
  analysisError = false,
}: JobListProps) {
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<JobView>(initialView);
  const [ownedSkills, setOwnedSkills] = useState<string[]>([]);
  const [profile, setProfile] = useState<CareerProfile>(EMPTY_CAREER_PROFILE);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [direction, setDirection] = useState(initialDirection);
  const items = useMemo(() => postings?.items ?? [], [postings]);
  const filtering = Boolean(
    filters.query || filters.category || filters.careerType || direction,
  );
  const summary = useMemo(() => buildJobsSummary(items), [items]);
  const careerAnalysis = useMemo(
    () =>
      buildCareerAnalysis({
        profile,
        ownedSkills,
        postings: analysisPostings.length > 0 ? analysisPostings : items,
      }),
    [analysisPostings, items, ownedSkills, profile],
  );
  const pageAnalysis = useMemo(
    () => buildCareerAnalysis({ profile, ownedSkills, postings: items }),
    [items, ownedSkills, profile],
  );
  const directionItems = useMemo(
    () =>
      direction
        ? items.filter(
            (posting) =>
              pageAnalysis.jobConnections[posting.id]?.directionId === direction,
          )
        : items,
    [direction, items, pageAnalysis.jobConnections],
  );
  const matchingCount = useMemo(
    () =>
      filterJobPostings(
        directionItems,
        "matched",
        ownedSkills,
        savedIds,
        profile,
      ).length,
    [directionItems, ownedSkills, profile, savedIds],
  );
  const savedCount = useMemo(
    () => filterJobPostings(directionItems, "saved", ownedSkills, savedIds).length,
    [directionItems, ownedSkills, savedIds],
  );
  const visibleJobs = useMemo(
    () => filterJobPostings(directionItems, view, ownedSkills, savedIds, profile),
    [directionItems, ownedSkills, profile, savedIds, view],
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
    setProfile(readCareerProfile());
    setSavedIds(readSavedJobIds());
    setHydrated(true);
    const unsubscribeOwned = subscribeOwnedSkills(setOwnedSkills);
    const unsubscribeProfile = subscribeCareerProfile(setProfile);
    const unsubscribeSaved = subscribeSavedJobs(setSavedIds);
    return () => {
      unsubscribeOwned();
      unsubscribeProfile();
      unsubscribeSaved();
    };
  }, []);

  useEffect(() => setView(initialView), [initialView]);

  useEffect(() => setDirection(initialDirection), [initialDirection]);

  function handleToggleSaved(id: string) {
    setSavedIds(toggleSavedJob(id));
  }

  const retryParams = new URLSearchParams();
  if (filters.query) retryParams.set("q", filters.query);
  if (filters.category) retryParams.set("category", filters.category);
  if (filters.careerType) retryParams.set("career_type", filters.careerType);
  if (direction) retryParams.set("direction", direction);
  if (currentPage > 1) retryParams.set("page", String(currentPage));
  if (view !== "all") retryParams.set("view", view);
  const retryQuery = retryParams.toString();
  const retryHref = `/jobs${retryQuery ? `?${retryQuery}` : ""}`;
  const resultAnnouncement = !hydrated
    ? "저장한 공고와 기술을 확인하고 있습니다."
    : visibleJobs.length
      ? view === "all"
        ? `전체 ${total}개 공고 중 ${pageStart + 1}번부터 ${pageEnd}번까지 표시합니다.`
        : `현재 페이지에서 ${visibleJobs.length}개 공고를 표시합니다.`
      : "표시할 공고가 없습니다.";

  function selectView(nextView: JobView) {
    setView(nextView);
  }

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (filters.query) params.set("q", filters.query);
    if (filters.category) params.set("category", filters.category);
    if (filters.careerType) params.set("career_type", filters.careerType);
    if (direction) params.set("direction", direction);
    if (view !== "all") params.set("view", view);
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return `/jobs${query ? `?${query}` : ""}`;
  }

  return (
    <main
      className={styles.main}
      data-analysis-snapshot={careerAnalysis.snapshotId}
      data-analysis-version={careerAnalysis.version}
    >
      <header className={styles.intro}>
        <h1>채용공고 찾기</h1>
        <p className={styles.description}>
          수집된 기업 공식 채용 페이지의 공개 공고를 검색하고, 내 경력·기술과
          연결되는 근거 및 확인되지 않은 조건을 살펴봅니다.
        </p>
        <ul className={styles.summary} aria-label="현재 공고 데이터 범위" role="list">
          {error ? (
            <>
              <li>
                <strong>공고 집계 불가</strong>
                <span>API 응답 확인 필요</span>
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
                <strong>전체 채용공고 {total.toLocaleString("ko-KR")}건</strong>
                <span>{filtering ? "현재 검색 조건" : "커리어핏이 분석한 채용공고 범위"}</span>
              </li>
              <li>
                <strong>이번 페이지 기업 {summary.companyCount}곳</strong>
                <span>{items.length}개 공고 표시</span>
              </li>
              <li>
                <strong>{summary.latestVerifiedLabel}</strong>
                <span>최근 확인</span>
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
            <div className={styles.field}>
              <label htmlFor="career-direction">커리어 방향</label>
              <select
                id="career-direction"
                name="direction"
                onChange={(event) => setDirection(event.target.value)}
                value={direction}
              >
                <option value="">전체 방향</option>
                {careerAnalysis.directions.map((item) => (
                  <option key={item.domain} value={item.domain}>
                    {item.label} · {item.kind === "direct"
                      ? "직접"
                      : item.kind === "adjacent"
                        ? "인접"
                        : item.kind === "interest"
                          ? "관심"
                          : "전환 폭 큼"}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.filterActions}>
              <button className={styles.searchButton} type="submit">
                채용공고 검색
              </button>
              {filtering && (
                <Link
                  className={styles.resetLink}
                  href="/jobs"
                  prefetch={false}
                >
                  검색 조건 초기화
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
          {analysisError ? (
            <p className={styles.analysisNotice} role="status">
              전체 분석 표본을 불러오지 못해 현재 페이지의 공고만 비교합니다.
            </p>
          ) : null}
          <div className={styles.trustNote}>
            <ShieldCheck aria-hidden="true" size={19} weight="fill" />
            <p>
              지원 전 공식 채용 페이지에서 최신 조건을 확인해 주세요. 저장 공고와 내
              기술은 브라우저에, 저장 검색은 로그인 계정에 남습니다.
            </p>
            <Link href="/data-policy" prefetch={false}>
              데이터 정책
            </Link>
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
                  ? "채용공고 데이터"
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
                aria-label={`추천 공고 ${matchingCount}`}
                aria-pressed={view === "matched"}
                onClick={() => selectView("matched")}
                type="button"
              >
                추천 공고 <span>{matchingCount}</span>
              </button>
              <button
                aria-label={`저장한 공고 ${savedCount}`}
                aria-pressed={view === "saved"}
                onClick={() => selectView("saved")}
                type="button"
              >
                저장한 공고 <span>{savedCount}</span>
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
                <h3>조건에 맞는 채용공고가 없습니다.</h3>
                <p>검색 조건을 조정해 주세요.</p>
              </div>
              <Link href="/jobs">전체 공고 보기</Link>
            </div>
          ) : visibleJobs.length === 0 ? (
            <ViewEmptyState
              hasProfile={ownedSkills.length > 0 || Boolean(profile.currentRole)}
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
                      profile={profile}
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
            </>
          )}
        </section>
      </div>
    </main>
  );
}
