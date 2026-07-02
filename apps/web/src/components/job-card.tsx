import Link from "next/link";

import type { PostingSummary } from "@/lib/types";

import { SourceMeta } from "./source-meta";


const CAREER_LABELS: Record<string, string> = {
  new_comer: "신입",
  newcomer: "신입",
  experienced: "경력",
  mixed: "신입·경력",
};


export function JobCard({ job }: { job: PostingSummary }) {
  const careerLabel = job.career_type
    ? CAREER_LABELS[job.career_type] ?? job.career_type
    : "경력 무관";

  return (
    <article className="job-row">
      <div className="job-row__company">
        <span>{job.company_name}</span>
        <span className="job-row__location">
          {job.location ?? "근무지 미정"}
        </span>
      </div>
      <div className="job-row__main">
        <Link href={`/jobs/${job.id}`} className="job-row__title">
          {job.title}
        </Link>
        <div className="job-row__facts" aria-label="채용 조건">
          <span>{careerLabel}</span>
          {job.employment_type && <span>{job.employment_type}</span>}
        </div>
        <SourceMeta
          sourceUrl={job.source_url}
          lastVerifiedAt={job.last_verified_at}
        />
      </div>
    </article>
  );
}
