import Link from "next/link";

import type { DashboardJob } from "./types";


type JobInspectorPanelProps = {
  selectedJob: DashboardJob | null;
  jobs: DashboardJob[];
};


function DefaultPanel({ jobs }: { jobs: DashboardJob[] }) {
  const topJobs = jobs.slice(0, 3);

  return (
    <>
      <header className="job-inspector__header">
        <span>오늘 확인</span>
        <h2>확인할 공고</h2>
        <p>맞춤도가 높은 공고를 먼저 훑고, 필요하면 상세 분석을 열어보세요.</p>
      </header>
      <ul className="job-inspector__brief-list">
        {topJobs.map((job) => (
          <li key={job.id}>
            <strong>{job.companyName}</strong>
            <span>{job.title}</span>
          </li>
        ))}
        {topJobs.length === 0 && <li>내 스택을 입력하면 확인할 공고가 정리됩니다.</li>}
      </ul>
    </>
  );
}


function SelectedPanel({ job }: { job: DashboardJob }) {
  return (
    <>
      <header className="job-inspector__header">
        <span>공고 상세 분석</span>
        <h2>{job.companyName}</h2>
        <p>{job.title}</p>
      </header>

      <section className="job-inspector__section">
        <h3>왜 추천됨</h3>
        <ul>
          {job.recommendationReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </section>

      <section className="job-inspector__section">
        <h3>맞는 기술</h3>
        <div className="job-inspector__chips">
          {job.matchedSkills.length > 0
            ? job.matchedSkills.map((skill) => <span key={skill}>{skill}</span>)
            : <span>조건 확인 필요</span>}
        </div>
      </section>

      <section className="job-inspector__section">
        <h3>부족 기술</h3>
        <div className="job-inspector__chips job-inspector__chips--missing">
          {job.missingSkills.length > 0
            ? job.missingSkills.map((skill) => <span key={skill}>{skill}</span>)
            : <span>큰 부족 기술 없음</span>}
        </div>
      </section>

      <div className="job-inspector__actions">
        <Link href={`/jobs/${job.id}`}>
          상세 보기
          <span aria-hidden="true">›</span>
        </Link>
        {job.sourceUrl && (
          <a href={job.sourceUrl} target="_blank" rel="noreferrer">
            원문 보기
            <span aria-hidden="true">↗</span>
          </a>
        )}
      </div>
    </>
  );
}


export function JobInspectorPanel({ selectedJob, jobs }: JobInspectorPanelProps) {
  return (
    <aside className="job-inspector" aria-label="공고 상세 패널">
      <div className="daily-card-core job-inspector__core">
        {selectedJob ? <SelectedPanel job={selectedJob} /> : <DefaultPanel jobs={jobs} />}
      </div>
    </aside>
  );
}
