"use client";

import {
  ArrowRight,
  ArrowSquareOut,
  Briefcase,
  Buildings,
  ChatCircleText,
  CheckCircle,
  MagnifyingGlass,
  ShieldCheck,
  Stack,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { CompanyMark } from "@/features/home-feed/company-mark";
import { formatCareer, formatEmployment } from "@/lib/labels";
import {
  readLocalCommunityPosts,
  subscribeLocalCommunityPosts,
  type LocalCommunityPost,
} from "@/lib/local-community-posts";

import {
  SEARCH_SCOPES,
  buildSearchScopeHref,
  mergeLocalCommunitySearchResults,
  type CommunitySearchResult,
  type CompanySearchResult,
  type JobSearchResult,
  type SearchScope,
  type SearchSnapshot,
  type SkillSearchResult,
} from "./model";
import styles from "./search-results.module.css";

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

const ALL_SCOPE_LIMITS = {
  companies: 4,
  jobs: 6,
  skills: 8,
  community: 4,
} as const;

function formatVerifiedDate(value: string | null) {
  if (!value || Number.isNaN(Date.parse(value))) return "확인 시각 없음";
  return `${new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value))} 확인`;
}

function scopeCount(snapshot: SearchSnapshot, scope: SearchScope) {
  if (scope === "all") return null;
  return snapshot.counts[scope];
}

function resultLimit(scope: SearchScope, target: keyof typeof ALL_SCOPE_LIMITS) {
  return scope === "all" ? ALL_SCOPE_LIMITS[target] : Number.POSITIVE_INFINITY;
}

function shows(scope: SearchScope, target: Exclude<SearchScope, "all">) {
  return scope === "all" || scope === target;
}

function SectionHeader({
  count,
  description,
  query,
  scope,
  title,
}: {
  count: number | null;
  description: string;
  query: string;
  scope: Exclude<SearchScope, "all">;
  title: string;
}) {
  return (
    <header className={styles.sectionHeader}>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className={styles.sectionMeta}>
        <span>{count === null ? "확인 불가" : `${count}건`}</span>
        <Link href={buildSearchScopeHref(query, scope)}>
          범위만 보기
          <ArrowRight aria-hidden="true" size={14} weight="bold" />
        </Link>
      </div>
    </header>
  );
}

function SectionState({ children }: { children: string }) {
  return <p className={styles.sectionState}>{children}</p>;
}

function CompanyResult({ company }: { company: CompanySearchResult }) {
  return (
    <article className={styles.companyResult}>
      <CompanyMark
        companyName={company.name}
        size={52}
        sourceUrl={company.sourceUrl}
      />
      <div className={styles.companyCopy}>
        <p>현재 검색 응답 공고 {company.postingCount}건</p>
        <h3>
          <Link aria-label={`${company.name} 기업 채용 현황`} href={company.href}>
            {company.name}
          </Link>
        </h3>
        <span>{formatVerifiedDate(company.latestVerifiedAt)}</span>
      </div>
      {company.skillNames.length > 0 && (
        <ul aria-label={`${company.name} 관련 기술`} className={styles.inlineSkills}>
          {company.skillNames.map((skill) => (
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
      )}
    </article>
  );
}

function JobResult({ job }: { job: JobSearchResult }) {
  const skills = [
    ...job.requiredSkills.map((name) => ({ name, kind: "required" })),
    ...job.preferredSkills.map((name) => ({ name, kind: "preferred" })),
    ...job.unspecifiedSkills.map((name) => ({ name, kind: "mentioned" })),
  ].slice(0, 5);

  return (
    <article className={styles.jobResult}>
      <div className={styles.resultTopline}>
        <span className={styles.officialBadge}>
          <ShieldCheck aria-hidden="true" size={15} weight="fill" />
          공식 공고
        </span>
        <span>{formatVerifiedDate(job.lastVerifiedAt)}</span>
      </div>
      <div className={styles.jobIdentity}>
        <CompanyMark companyName={job.companyName} size={48} sourceUrl={job.sourceUrl} />
        <div>
          <p>
            {job.companyHref ? (
              <Link href={job.companyHref}>{job.companyName}</Link>
            ) : (
              job.companyName
            )}
          </p>
          <h3>
            <Link href={job.href}>{job.title}</Link>
          </h3>
        </div>
      </div>
      <ul aria-label={`${job.title} 조건`} className={styles.jobFacts}>
        <li>{formatCareer(job.careerType)}</li>
        <li>{formatEmployment(job.employmentType)}</li>
        <li>{job.location ?? "근무지 미기재"}</li>
      </ul>
      {skills.length > 0 && (
        <ul aria-label={`${job.title} 기술`} className={styles.evidenceSkills}>
          {skills.map((skill) => (
            <li data-kind={skill.kind} key={`${skill.kind}-${skill.name}`}>
              {skill.kind === "required"
                ? "필수"
                : skill.kind === "preferred"
                  ? "우대"
                  : "언급"}{" "}
              {skill.name}
            </li>
          ))}
        </ul>
      )}
      <footer className={styles.resultActions}>
        <Link href={job.href}>
          공고 분석
          <ArrowRight aria-hidden="true" size={15} weight="bold" />
        </Link>
        <a href={job.sourceUrl} rel="noreferrer" target="_blank">
          공식 원문
          <ArrowSquareOut aria-hidden="true" size={14} weight="bold" />
        </a>
      </footer>
    </article>
  );
}

function SkillResult({ skill }: { skill: SkillSearchResult }) {
  const requirementCounts = [
    ["필수", skill.requiredCount],
    ["우대", skill.preferredCount],
    ["미분류", skill.unspecifiedCount],
  ] as const;
  const hasRequirementBreakdown = requirementCounts.some(
    ([, count]) => count !== null,
  );

  return (
    <article className={styles.skillResult}>
      <div className={styles.skillIcon}>
        <Stack aria-hidden="true" size={21} weight="bold" />
      </div>
      <div className={styles.skillCopy}>
        <span className={styles.sampleBadge}>공고 통계 표본</span>
        <h3>{skill.name}</h3>
        <p>{CATEGORY_LABELS[skill.category] ?? skill.category}</p>
      </div>
      <div className={styles.skillEvidence}>
        <strong>{skill.postingCount}건 공고</strong>
        <span>
          {hasRequirementBreakdown
            ? requirementCounts
                .map(([label, count]) => `${label} ${count ?? "미제공"}`)
                .join(" · ")
            : "필수·우대 분류 미제공"}
        </span>
      </div>
      <div className={styles.skillActions}>
        <Link aria-label={`${skill.name} 스킬맵 보기`} href={skill.skillHref}>
          스킬맵
          <ArrowRight aria-hidden="true" size={14} weight="bold" />
        </Link>
        <Link href={skill.jobsHref}>관련 공고</Link>
      </div>
    </article>
  );
}

function CommunityResult({
  item,
}: {
  item: CommunitySearchResult;
}) {
  return (
    <article aria-label={item.title} className={styles.communityResult}>
      <div className={styles.resultTopline}>
        <span className={styles.exampleBadge} data-source={item.source}>
          {item.source === "local"
            ? "내 로컬 글"
            : item.source === "server"
              ? "커뮤니티"
              : "예시 콘텐츠"}
        </span>
        <span>{item.createdLabel}</span>
      </div>
      <p className={styles.communityAuthor}>
        <strong>{item.authorName}</strong>
        <span>{item.authorHeadline}</span>
      </p>
      <h3>
        <Link href={item.href}>{item.title}</Link>
      </h3>
      <p className={styles.communitySummary}>{item.summary}</p>
      <ul aria-label={`${item.title} 태그`} className={styles.communityTags}>
        {item.tags.map((tag) => (
          <li key={tag}>
            <Link
              aria-label={`${tag} 커뮤니티 검색`}
              href={buildSearchScopeHref(tag, "community")}
            >
              {tag}
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function SearchResults({
  snapshot: serverSnapshot,
}: {
  snapshot: SearchSnapshot;
}) {
  const [localPosts, setLocalPosts] = useState<LocalCommunityPost[]>([]);

  useEffect(() => {
    const unsubscribe = subscribeLocalCommunityPosts(setLocalPosts);
    setLocalPosts(readLocalCommunityPosts());
    return unsubscribe;
  }, []);

  const snapshot = useMemo(
    () => mergeLocalCommunitySearchResults(serverSnapshot, localPosts),
    [localPosts, serverSnapshot],
  );
  const { query, scope } = snapshot;

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>통합 탐색</p>
        <h1>
          {query ? (
            <>
              <span>“{query}”</span>{" "}
              <span className={styles.resultTitleSuffix}>검색 결과</span>
            </>
          ) : (
            "무엇을 찾고 있나요?"
          )}
        </h1>
        <p className={styles.description}>
          공식 채용 데이터와 내 로컬 글·커뮤니티 예시를 출처별로 나눠 확인하세요.
        </p>
        <form action="/search" className={styles.searchForm} method="get" role="search">
          <MagnifyingGlass aria-hidden="true" size={20} />
          <input
            aria-label="검색어"
            defaultValue={query}
            key={query || "empty-search"}
            maxLength={200}
            name="q"
            placeholder="회사, 직무, 기술, 주제"
            type="search"
          />
          {scope !== "all" && <input name="scope" type="hidden" value={scope} />}
          <button type="submit">검색</button>
        </form>
      </header>

      {snapshot.dataStatus === "idle" ? (
        <section className={styles.startState}>
          <MagnifyingGlass aria-hidden="true" size={28} />
          <div>
            <h2>검색어를 입력하면 결과를 나눠 보여드려요.</h2>
            <p>
              기업·공고·기술은 실제 공개 채용 데이터에서, 커뮤니티는 이 브라우저의
              내 글과 화면용 예시에서 찾습니다.
            </p>
          </div>
          <div className={styles.startLinks}>
            <Link href="/jobs">전체 공고 보기</Link>
            <Link href="/market">채용 시장 보기</Link>
          </div>
        </section>
      ) : (
        <div className={styles.workspace}>
          <aside className={styles.scopePanel}>
            <p>결과 범위</p>
            <nav aria-label="검색 범위">
              {SEARCH_SCOPES.map((item) => {
                const count = scopeCount(snapshot, item.value);
                return (
                  <Link
                    aria-current={scope === item.value ? "page" : undefined}
                    data-active={scope === item.value ? "true" : undefined}
                    href={buildSearchScopeHref(query, item.value)}
                    key={item.value}
                  >
                    <span>{item.label}</span>
                    {item.value !== "all" && (
                      <small>{count === null ? "—" : count}</small>
                    )}
                  </Link>
                );
              })}
            </nav>
            <div className={styles.boundaryNote}>
              <CheckCircle aria-hidden="true" size={17} weight="fill" />
              <p>
                기업·공고·기술 수치는 전체 검색량이 아니라 현재 API 응답과 통계 표본
                범위입니다.
              </p>
            </div>
          </aside>

          <div className={styles.resultsColumn}>
            {snapshot.dataStatus !== "ready" && (
              <section className={styles.dataNotice} role="status">
                <WarningCircle aria-hidden="true" size={20} weight="fill" />
                <div>
                  <h2>
                    {snapshot.dataStatus === "partial"
                      ? "일부 실제 검색 결과를 불러오지 못했습니다."
                      : "실제 검색 데이터를 불러오지 못했습니다."}
                  </h2>
                  <ul aria-label="검색 데이터 오류">
                    {snapshot.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                  <Link href={buildSearchScopeHref(query, scope)}>다시 시도</Link>
                </div>
              </section>
            )}

            {snapshot.dataStatus === "ready" && !snapshot.hasAnyResults ? (
              <section className={styles.noResults}>
                <MagnifyingGlass aria-hidden="true" size={27} />
                <h2>검색 결과가 없습니다.</h2>
                <p>표현을 줄이거나 기술·기업 이름으로 다시 검색해 보세요.</p>
                <Link href="/search">검색어 지우기</Link>
              </section>
            ) : (
              <>
                {shows(scope, "companies") && (
                  <section aria-labelledby="company-results-title" className={styles.resultSection}>
                    <span className={styles.anchorTitle} id="company-results-title">기업</span>
                    <SectionHeader
                      count={snapshot.counts.companies}
                      description="검색된 공식 공고 응답에서 확인한 관련 기업입니다."
                      query={query}
                      scope="companies"
                      title="기업"
                    />
                    {snapshot.counts.companies === null ? (
                      <SectionState>공고 기반 기업 결과를 현재 확인할 수 없습니다.</SectionState>
                    ) : snapshot.companies.length === 0 ? (
                      <SectionState>현재 공고 응답에서 관련 기업을 찾지 못했습니다.</SectionState>
                    ) : (
                      <div className={styles.companyGrid}>
                        {snapshot.companies
                          .slice(0, resultLimit(scope, "companies"))
                          .map((company) => (
                            <CompanyResult company={company} key={company.slug} />
                          ))}
                      </div>
                    )}
                  </section>
                )}

                {shows(scope, "jobs") && (
                  <section aria-labelledby="job-results-title" className={styles.resultSection}>
                    <span className={styles.anchorTitle} id="job-results-title">공고</span>
                    <SectionHeader
                      count={snapshot.counts.jobs}
                      description="공식 채용페이지의 현재 공개 공고 검색 응답입니다."
                      query={query}
                      scope="jobs"
                      title="공고"
                    />
                    {snapshot.counts.jobs === null ? (
                      <SectionState>공식 공고 검색 결과를 현재 확인할 수 없습니다.</SectionState>
                    ) : snapshot.jobs.length === 0 ? (
                      <SectionState>현재 조건에서 확인된 공식 공고가 없습니다.</SectionState>
                    ) : (
                      <div className={styles.jobGrid}>
                        {snapshot.jobs
                          .slice(0, resultLimit(scope, "jobs"))
                          .map((job) => (
                            <JobResult job={job} key={job.id} />
                          ))}
                      </div>
                    )}
                  </section>
                )}

                {shows(scope, "skills") && (
                  <section aria-labelledby="skill-results-title" className={styles.resultSection}>
                    <span className={styles.anchorTitle} id="skill-results-title">기술</span>
                    <SectionHeader
                      count={snapshot.counts.skills}
                      description="현재 기술 수요 상위 표본에서 이름이 일치한 기술입니다."
                      query={query}
                      scope="skills"
                      title="기술"
                    />
                    {snapshot.counts.skills === null ? (
                      <SectionState>기술 통계 표본을 현재 확인할 수 없습니다.</SectionState>
                    ) : snapshot.skills.length === 0 ? (
                      <SectionState>현재 통계 표본에서 일치하는 기술이 없습니다.</SectionState>
                    ) : (
                      <div className={styles.skillList}>
                        {snapshot.skills
                          .slice(0, resultLimit(scope, "skills"))
                          .map((skill) => (
                            <SkillResult key={skill.name} skill={skill} />
                          ))}
                      </div>
                    )}
                  </section>
                )}

                {shows(scope, "community") && (
                  <section aria-labelledby="community-results-title" className={styles.resultSection}>
                    <span className={styles.anchorTitle} id="community-results-title">커뮤니티</span>
                    <SectionHeader
                      count={snapshot.counts.community}
                      description="현재 브라우저의 내 글과 화면 흐름용 예시 결과입니다."
                      query={query}
                      scope="community"
                      title="커뮤니티"
                    />
                    <p className={styles.mockDisclosure}>
                      내 로컬 글은 현재 브라우저에서만 검색됩니다. 예시 콘텐츠는 실제
                      사용자가 작성한 글이 아니며, 공고·기술 수치와 혼합해 사실처럼
                      표시하지 않습니다.
                    </p>
                    {snapshot.community.length === 0 ? (
                      <SectionState>일치하는 커뮤니티 글이 없습니다.</SectionState>
                    ) : (
                      <div className={styles.communityList}>
                        {snapshot.community
                          .slice(0, resultLimit(scope, "community"))
                          .map((item) => (
                            <CommunityResult item={item} key={item.id} />
                          ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
