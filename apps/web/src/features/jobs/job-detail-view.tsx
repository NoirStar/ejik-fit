import {
  ArrowLeft,
  ArrowSquareOut,
  CheckCircle,
  ShieldCheck,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import styles from "@/app/jobs/[id]/job-detail.module.css";
import { SourceMeta } from "@/components/source-meta";
import { CompanyMark } from "@/features/home-feed/company-mark";
import { formatCareerRange } from "@/features/jobs/model";
import { formatEmployment, PRODUCT_TERMS } from "@/lib/labels";
import type { PostingDetail, SkillDetail } from "@/lib/types";

import { JobDetailActions } from "./job-detail-actions";
import { groupJobSkills } from "./job-detail-model";
import { PostingDescription } from "./job-description";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatPostingPeriod(
  opensAt: string | null,
  closesAt: string | null,
) {
  if (opensAt && closesAt) {
    return `${formatDate(opensAt)} – ${formatDate(closesAt)}`;
  }
  if (opensAt) return `${formatDate(opensAt)}부터 · 마감일 미기재`;
  if (closesAt) return `${formatDate(closesAt)} 마감`;
  return "접수 기간 미기재";
}

function statusLabel(status: string) {
  if (status === "open") return "공개 중";
  if (status === "closed") return "마감";
  if (status === "delayed") return "확인 지연";
  return "상태 확인 필요";
}

function SkillGroup({
  label,
  skills,
  tone,
}: {
  label: string;
  skills: SkillDetail[];
  tone: "required" | "preferred" | "mentioned";
}) {
  if (skills.length === 0) return null;

  return (
    <section className={styles.skillGroup} data-tone={tone}>
      <header>
        <h3>{label}</h3>
        <span>{skills.length}개</span>
      </header>
      <ul role="list">
        {skills.map((skill) => (
          <li key={`${skill.requirement_type}-${skill.skill}`}>
            <Link
              aria-label={`${skill.skill} 스킬맵`}
              href={`/skill-map?skill=${encodeURIComponent(skill.skill)}`}
              prefetch={false}
            >
              {skill.skill}
            </Link>
            {skill.evidence_text && <q>{skill.evidence_text}</q>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function JobDetailView({ job }: { job: PostingDetail }) {
  const skillDetails = job.skill_details ?? [];
  const groups = groupJobSkills(skillDetails);
  const isDelayed = job.status === "delayed";

  return (
    <main className={styles.main}>
      <Link className={styles.backLink} href="/jobs">
        <ArrowLeft aria-hidden="true" size={16} weight="bold" />
        채용공고로 돌아가기
      </Link>

      <article className={styles.article}>
        <header className={styles.hero}>
          <CompanyMark
            companyName={job.company_name}
            size={56}
            sourceUrl={job.source_url}
          />
          <div className={styles.heroIdentity}>
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
            <h1>{job.title}</h1>
          </div>
          <span className={styles.status} data-state={job.status}>
            {isDelayed ? (
              <WarningCircle aria-hidden="true" size={16} weight="fill" />
            ) : (
              <CheckCircle aria-hidden="true" size={16} weight="fill" />
            )}
            {statusLabel(job.status)}
          </span>
        </header>

        {isDelayed ? (
          <section
            aria-label="공고 검증 지연 안내"
            className={styles.verificationNotice}
            role="status"
          >
            <WarningCircle aria-hidden="true" size={20} weight="fill" />
            <div>
              <strong>공식 출처 확인이 지연되고 있습니다.</strong>
              <p>
                최근 자동 수집에서 이 공고를 재확인하지 못했습니다. 현재 모집
                여부를 공식 원문에서 다시 확인해 주세요.
              </p>
            </div>
          </section>
        ) : null}

        <section
          aria-labelledby="job-facts-title"
          className={styles.factsSection}
        >
          <h2 id="job-facts-title">채용 조건</h2>
          <dl className={styles.facts}>
            <div>
              <dt>경력</dt>
              <dd>{formatCareerRange(job)}</dd>
            </div>
            <div>
              <dt>고용 형태</dt>
              <dd>{formatEmployment(job.employment_type)}</dd>
            </div>
            <div>
              <dt>근무지</dt>
              <dd>{job.location ?? "미기재"}</dd>
            </div>
            <div>
              <dt>접수 기간</dt>
              <dd>{formatPostingPeriod(job.opens_at, job.closes_at)}</dd>
            </div>
          </dl>
        </section>

        <div className={styles.workspace}>
          <section
            aria-labelledby="job-skills-title"
            className={styles.skills}
          >
            <header className={styles.sectionHeader}>
              <p>기업 채용페이지에서 확인한 표현</p>
              <h2 id="job-skills-title">기술 요건</h2>
            </header>
            {skillDetails.length > 0 ? (
              <div className={styles.skillGroups}>
                <SkillGroup
                  label="필수 기술"
                  skills={groups.required}
                  tone="required"
                />
                <SkillGroup
                  label="우대 기술"
                  skills={groups.preferred}
                  tone="preferred"
                />
                <SkillGroup
                  label={PRODUCT_TERMS.unspecifiedRequirement}
                  skills={groups.unspecified}
                  tone="mentioned"
                />
              </div>
            ) : (
              <p className={styles.emptyEvidence}>
                확인된 기술 요건이 없습니다.
              </p>
            )}
          </section>

          <aside className={styles.sidebar}>
            <JobDetailActions
              jobId={job.id}
              jobTitle={job.title}
              skills={skillDetails}
              sourceUrl={job.source_url}
              status={job.status}
            />

            <section aria-label="공고 신뢰 정보" className={styles.trust}>
              <ShieldCheck aria-hidden="true" size={21} weight="fill" />
              <div>
                <h2>출처와 검증</h2>
                <p>기업 채용페이지와 확인 시각을 함께 확인해 주세요.</p>
                <SourceMeta
                  lastVerifiedAt={job.last_verified_at}
                  sourceUrl={job.source_url}
                />
                <nav aria-label="공고 정보 안내">
                  <Link href="/methodology" prefetch={false}>
                    분석 방법
                  </Link>
                  <Link href="/corrections" prefetch={false}>
                    정보 정정 요청
                  </Link>
                  <Link href="/data-policy" prefetch={false}>
                    데이터 정책
                  </Link>
                </nav>
              </div>
            </section>
          </aside>

          <section
            aria-labelledby="job-description-title"
            className={styles.description}
          >
            <header className={styles.sectionHeader}>
              <p>API가 제공한 원문 텍스트</p>
              <h2 id="job-description-title">공고 원문</h2>
            </header>
            <PostingDescription text={job.description_text} />
            <a
              className={styles.continueLink}
              href={job.source_url}
              rel="noreferrer"
              target="_blank"
            >
              공식 원문에서 계속 읽기
              <ArrowSquareOut aria-hidden="true" size={17} weight="bold" />
            </a>
          </section>
        </div>
      </article>
    </main>
  );
}
