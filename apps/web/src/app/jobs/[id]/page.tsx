import Link from "next/link";
import { notFound } from "next/navigation";

import { SourceMeta } from "@/components/source-meta";
import { ApiError, getPosting } from "@/lib/api";


export const dynamic = "force-dynamic";


type JobDetailProps = {
  params: Promise<{ id: string }>;
};


function formatDate(value: string | null): string {
  if (!value) {
    return "미정";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}


function formatCareer(value: string | null): string {
  const labels: Record<string, string> = {
    new_comer: "신입",
    newcomer: "신입",
    experienced: "경력",
    mixed: "신입·경력",
  };
  return value ? labels[value] ?? value : "경력 무관";
}


function formatPeriod(
  opensAt: string | null,
  closesAt: string | null,
): string {
  if (!opensAt && !closesAt) {
    return "상시 또는 미정";
  }
  return `${formatDate(opensAt)} - ${formatDate(closesAt)}`;
}


export default async function JobDetail({ params }: JobDetailProps) {
  const { id } = await params;
  let job;

  try {
    job = await getPosting(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }
    throw error;
  }

  return (
    <main className="detail-page">
      <Link href="/" className="back-link">
        ← 공고 목록
      </Link>

      <article className="job-detail">
        <header className="job-detail__header">
          <p>{job.company_name}</p>
          <h1>{job.title}</h1>
          <SourceMeta
            sourceUrl={job.source_url}
            lastVerifiedAt={job.last_verified_at}
            showSourceLink={false}
          />
        </header>

        <dl className="job-detail__facts">
          <div>
            <dt>경력</dt>
            <dd>{formatCareer(job.career_type)}</dd>
          </div>
          <div>
            <dt>고용 형태</dt>
            <dd>{job.employment_type ?? "미정"}</dd>
          </div>
          <div>
            <dt>근무지</dt>
            <dd>{job.location ?? "미정"}</dd>
          </div>
          <div>
            <dt>접수 기간</dt>
            <dd>{formatPeriod(job.opens_at, job.closes_at)}</dd>
          </div>
        </dl>

        <section className="job-description" aria-labelledby="description">
          <h2 id="description">공고 내용</h2>
          <div>{job.description_text}</div>
        </section>

        <a
          className="official-link"
          href={job.source_url}
          target="_blank"
          rel="noreferrer"
        >
          기업 채용페이지에서 지원하기
          <span aria-hidden="true"> ↗</span>
        </a>
      </article>
    </main>
  );
}
