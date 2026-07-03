import Link from "next/link";

import { formatCareer, formatEmployment } from "@/lib/labels";
import type { PostingSummary } from "@/lib/types";

import { SourceMeta } from "./source-meta";


export function JobCard({ job }: { job: PostingSummary }) {
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
          <span>{formatCareer(job.career_type)}</span>
          {job.employment_type && (
            <span>{formatEmployment(job.employment_type)}</span>
          )}
        </div>
        <SourceMeta
          sourceUrl={job.source_url}
          lastVerifiedAt={job.last_verified_at}
        />
      </div>
    </article>
  );
}
