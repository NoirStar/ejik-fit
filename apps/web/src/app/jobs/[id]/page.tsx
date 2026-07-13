import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SkillEvidence } from "@/components/skill-evidence";
import { SourceMeta } from "@/components/source-meta";
import { ApiError, getPosting } from "@/lib/api";
import { formatCareer, formatEmployment } from "@/lib/labels";
import { normalizePostingDetail } from "@/lib/posting-contract";
import type { PostingDetail } from "@/lib/types";

import styles from "./job-detail.module.css";

export const dynamic = "force-dynamic";

type JobDetailProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string | null): string {
  if (!value) return "미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "미정";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatPeriod(opensAt: string | null, closesAt: string | null): string {
  if (!opensAt && !closesAt) return "상시 또는 미정";
  return `${formatDate(opensAt)} - ${formatDate(closesAt)}`;
}

async function postingOrNotFound(id: string) {
  try {
    return normalizePostingDetail(await getPosting(id));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({ params }: JobDetailProps): Promise<Metadata> {
  const { id } = await params;
  const job = await postingOrNotFound(id);
  const location = job.location ?? "근무지 미기재";
  const career = formatCareer(job.career_type);

  return {
    title: `${job.title} - ${job.company_name}`,
    description: `${job.company_name} ${job.title}. ${location}, ${career} 공식 채용공고입니다.`,
    alternates: { canonical: `/jobs/${encodeURIComponent(id)}` },
  };
}

function jobPostingJsonLd(job: PostingDetail) {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    url: job.source_url,
    hiringOrganization: {
      "@type": "Organization",
      name: job.company_name,
    },
    ...(job.location
      ? {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location,
            },
          },
        }
      : {}),
    ...(job.employment_type ? { employmentType: job.employment_type } : {}),
    ...(job.opens_at ? { datePosted: job.opens_at } : {}),
    ...(job.closes_at ? { validThrough: job.closes_at } : {}),
  };
}

export default async function JobDetail({ params }: JobDetailProps) {
  const { id } = await params;
  const job = await postingOrNotFound(id);
  const jsonLd = JSON.stringify(jobPostingJsonLd(job)).replace(/</g, "\\u003c");

  return (
    <main className={styles.main}>
      <script dangerouslySetInnerHTML={{ __html: jsonLd }} type="application/ld+json" />

      <Link className={styles.backLink} href="/jobs">
        공고 탐색으로 돌아가기
      </Link>

      <article className={styles.article}>
        <header className={styles.header}>
          <p>{job.company_name}</p>
          <h1>{job.title}</h1>
        </header>

        <dl className={styles.facts}>
          <div>
            <dt>경력</dt>
            <dd>{formatCareer(job.career_type)}</dd>
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
            <dd>{formatPeriod(job.opens_at, job.closes_at)}</dd>
          </div>
        </dl>

        <section aria-label="공고 신뢰 정보" className={styles.trust}>
          <div>
            <h2>출처와 분석 기준</h2>
            <p>공식 원문과 마지막 검증 시각을 기준으로 내용을 확인해 주세요.</p>
          </div>
          <SourceMeta sourceUrl={job.source_url} lastVerifiedAt={job.last_verified_at} />
          <nav aria-label="공고 정보 안내">
            <Link href="/methodology">분석 방법</Link>
            <Link href="/corrections">정보 정정 요청</Link>
          </nav>
        </section>

        <SkillEvidence skills={job.skill_details ?? []} />

        <section aria-labelledby="description" className={styles.description}>
          <h2 id="description">공고 내용</h2>
          <div>{job.description_text}</div>
        </section>

        <a
          className={styles.applyLink}
          href={job.source_url}
          rel="noreferrer"
          target="_blank"
        >
          기업 채용페이지에서 지원하기
        </a>
      </article>
    </main>
  );
}
