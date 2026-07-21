import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  ShieldCheck,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import { CompanyMark } from "@/features/home-feed/company-mark";
import { buildJobEvidence, formatCareerRange, formatClosingDate, formatVerifiedDate } from "@/features/jobs/model";
import { formatEmployment } from "@/lib/labels";
import type {
  PostingListResponse,
  PostingSummary,
  SourceDirectoryItem,
} from "@/lib/types";

import styles from "./company-profile.module.css";
import { CompanyFollowButton } from "./company-follow-button";
import {
  buildCompanyHiringSnapshot,
  type CompanyDistributionItem,
  type CompanySkillEvidence,
} from "./model";

type CompanyProfileProps = {
  companySlug: string;
  postings: PostingListResponse | null;
  source?: SourceDirectoryItem | null;
  error?: boolean;
};

function CompanyState({
  companySlug,
  error,
  source,
}: {
  companySlug: string;
  error: boolean;
  source?: SourceDirectoryItem | null;
}) {
  const companyName = source?.company_name;

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/jobs">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        공고 탐색으로 돌아가기
      </Link>
      <section className={styles.state} role={error ? "alert" : undefined}>
        <p className={styles.eyebrow}>공식 채용 공고 기준</p>
        <h1>
          {error
            ? "기업 공고 데이터를 불러오지 못했습니다."
            : companyName
              ? `${companyName}의 현재 공개 공고가 없습니다.`
              : "현재 확인되는 공개 공고가 없습니다."}
        </h1>
        <p>
          {error
            ? `${companyName ? `${companyName}의 ` : ""}현재 공고 수를 0건으로 단정하지 않습니다. 잠시 후 다시 확인해 주세요.`
            : "최근 수집 기준으로 공식 채용페이지에서 공개 상태 공고가 확인되지 않았습니다."}
        </p>
        <nav aria-label="기업 공고 상태 안내">
          {error && (
            <Link href={`/companies/${encodeURIComponent(companySlug)}`}>
              다시 시도
            </Link>
          )}
          {source && (
            <a
              aria-label={`${source.company_name} 공식 채용페이지`}
              href={source.careers_url}
              rel="noreferrer"
              target="_blank"
            >
              공식 채용페이지
              <ArrowSquareOut aria-hidden="true" size={14} weight="bold" />
            </a>
          )}
          <Link href="/jobs">전체 공고 보기</Link>
          <Link href="/data-policy">데이터 정책</Link>
        </nav>
      </section>
    </main>
  );
}

function SkillCounts({ skill }: { skill: CompanySkillEvidence }) {
  const counts = [
    skill.requiredCount > 0 ? `필수 ${skill.requiredCount}` : null,
    skill.preferredCount > 0 ? `우대 ${skill.preferredCount}` : null,
    skill.unspecifiedCount > 0 ? `언급 ${skill.unspecifiedCount}` : null,
  ].filter(Boolean);

  return <span>{counts.join(" · ")}</span>;
}

function Distribution({
  items,
  title,
}: {
  items: CompanyDistributionItem[];
  title: string;
}) {
  return (
    <section className={styles.distribution}>
      <h3>{title}</h3>
      <ul role="list">
        {items.map((item) => (
          <li key={item.label}>
            <span>{item.label}</span>
            <strong>{item.count}</strong>
          </li>
        ))}
      </ul>
    </section>
  );
}

function JobSkills({ job }: { job: PostingSummary }) {
  const evidence = buildJobEvidence(job, []);
  const skills = [
    ...evidence.requiredSkills.map((name) => ({ name, tone: "required" })),
    ...evidence.preferredSkills.map((name) => ({ name, tone: "preferred" })),
    ...evidence.unspecifiedSkills.map((name) => ({ name, tone: "mentioned" })),
  ].slice(0, 8);

  if (skills.length === 0) {
    return (
      <p className={styles.noSkills}>
        확정 임계값을 통과한 기술 요구사항이 없습니다.
      </p>
    );
  }

  return (
    <ul aria-label={`${job.title} 요구 기술`} className={styles.jobSkills} role="list">
      {skills.map((skill) => (
        <li data-tone={skill.tone} key={`${skill.tone}-${skill.name}`}>
          {skill.name}
        </li>
      ))}
    </ul>
  );
}

function CompanyJob({ job, index }: { job: PostingSummary; index: number }) {
  const closing = formatClosingDate(job.closes_at);

  return (
    <li>
      <article className={styles.job}>
        <header className={styles.jobHeader}>
          <span className={styles.jobIndex} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div>
            <h3>
              <Link href={`/jobs/${encodeURIComponent(job.id)}`}>{job.title}</Link>
            </h3>
            <span className={styles.openStatus}>
              <CheckCircle aria-hidden="true" size={14} weight="fill" />
              공개 중
            </span>
          </div>
        </header>

        <dl className={styles.jobFacts}>
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
          <div>
            <dt>접수</dt>
            <dd>{closing ?? "마감일 미기재"}</dd>
          </div>
        </dl>

        <JobSkills job={job} />

        <footer className={styles.jobFooter}>
          <span>{formatVerifiedDate(job.last_verified_at)}</span>
          <div>
            <Link href={`/jobs/${encodeURIComponent(job.id)}`}>공고 분석</Link>
            <a href={job.source_url} rel="noreferrer" target="_blank">
              공식 원문
              <ArrowSquareOut aria-hidden="true" size={15} weight="bold" />
            </a>
          </div>
        </footer>
      </article>
    </li>
  );
}

export function CompanyProfile({
  companySlug,
  postings,
  source,
  error = false,
}: CompanyProfileProps) {
  if (error || !postings) {
    return <CompanyState companySlug={companySlug} error source={source} />;
  }
  if (postings.items.length === 0) {
    return (
      <CompanyState companySlug={companySlug} error={false} source={source} />
    );
  }

  const snapshot = buildCompanyHiringSnapshot(postings.items);
  const companyName =
    source?.company_name ?? snapshot.companyName ?? postings.items[0].company_name;
  const primarySource = source?.careers_url ?? postings.items[0].source_url;
  const totalPostingCount = Math.max(
    postings.total,
    source?.open_postings ?? 0,
    snapshot.postingCount,
  );
  const hasMorePostings = totalPostingCount > snapshot.postingCount;

  return (
    <main className={styles.page}>
      <Link className={styles.backLink} href="/jobs">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        공고 탐색으로 돌아가기
      </Link>

      <header className={styles.hero}>
        <CompanyMark
          companyName={companyName}
          size={76}
          sourceUrl={primarySource}
        />
        <div className={styles.heroIdentity}>
          <h1>{companyName}</h1>
          <p>
            현재 공개 상태로 확인된 채용 공고에서 기술과 채용 조건을 모았습니다.
          </p>
        </div>
        <div className={styles.heroActions}>
          <CompanyFollowButton
            companyName={companyName}
            companySlug={companySlug}
          />
          <a
            className={styles.sourceLink}
            href={primarySource}
            rel="noreferrer"
            target="_blank"
          >
            최근 공식 원문
            <ArrowSquareOut aria-hidden="true" size={16} weight="bold" />
          </a>
        </div>
      </header>

      <section aria-labelledby="company-snapshot-title">
        <h2 className={styles.srOnly} id="company-snapshot-title">
          현재 기업 채용 스냅샷
        </h2>
        <dl className={styles.metrics}>
          <div>
            <dt>공고 범위</dt>
            <dd>현재 공개 공고 {totalPostingCount.toLocaleString("ko-KR")}건</dd>
          </div>
          <div>
            <dt>기술 근거</dt>
            <dd>확정 기술 {snapshot.uniqueSkillCount}개</dd>
          </div>
          <div>
            <dt>근무 범위</dt>
            <dd>근무 지역 {snapshot.locationCount}곳</dd>
          </div>
          <div>
            <dt>최근 검증</dt>
            <dd>{formatVerifiedDate(snapshot.latestVerifiedAt)}</dd>
          </div>
        </dl>
      </section>

      <div className={styles.workspace}>
        <section
          aria-label="현재 공개 공고"
          className={styles.jobsPanel}
        >
          <header className={styles.sectionHeader}>
            <div>
              <p>{hasMorePostings ? "최근 확인 공고 분석 범위" : "현재 확인 공고"}</p>
              <h2>공개 공고</h2>
            </div>
            <span>
              {hasMorePostings
                ? `${snapshot.postingCount.toLocaleString("ko-KR")} / ${totalPostingCount.toLocaleString("ko-KR")}건 표시`
                : `${snapshot.postingCount.toLocaleString("ko-KR")}건`}
            </span>
          </header>
          <ul className={styles.jobs} role="list">
            {postings.items.map((job, index) => (
              <CompanyJob index={index} job={job} key={job.id} />
            ))}
          </ul>
        </section>

        <aside aria-label="기업 채용 근거" className={styles.evidencePanel}>
          <section className={styles.skillsSection}>
            <header className={styles.asideHeader}>
              <p>공고 단위 확인 횟수</p>
              <h2>요구 기술</h2>
            </header>
            {snapshot.skills.length > 0 ? (
              <ol className={styles.skills} role="list">
                {snapshot.skills.slice(0, 12).map((skill, index) => (
                  <li key={skill.name}>
                    <span className={styles.skillRank} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <Link
                        aria-label={`${skill.name} 스킬맵`}
                        href={`/skill-map?skill=${encodeURIComponent(skill.name)}`}
                      >
                        {skill.name}
                      </Link>
                      <SkillCounts skill={skill} />
                    </div>
                    <strong>{skill.postingCount}개 공고</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.noEvidence}>
                확정 임계값을 통과한 기술 요구사항이 없습니다.
              </p>
            )}
          </section>

          <div className={styles.distributions}>
            <Distribution items={snapshot.careers} title="경력 조건" />
            <Distribution items={snapshot.employmentTypes} title="고용 형태" />
            <Distribution items={snapshot.locations} title="근무지" />
          </div>

          <section className={styles.trust}>
            <ShieldCheck aria-hidden="true" size={21} weight="fill" />
            <div>
              <h2>이 수치를 읽는 기준</h2>
              <p>
                {hasMorePostings
                  ? `공개 공고 총수는 API의 전체 결과이며, 기술과 채용 조건은 최근 ${snapshot.postingCount.toLocaleString("ko-KR")}개 공고를 기준으로 집계합니다. `
                  : "공개 공고와 기술·채용 조건은 현재 확인된 공고를 기준으로 집계합니다. "}
                기술은 공고별로 한 번만 세며 시장 전체나 기업 규모를 뜻하지 않습니다.
              </p>
              <nav aria-label="기업 채용 데이터 안내">
                <Link href="/methodology">분석 방법</Link>
                <Link href="/data-policy">데이터 정책</Link>
                <Link href="/corrections">정보 정정</Link>
              </nav>
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
