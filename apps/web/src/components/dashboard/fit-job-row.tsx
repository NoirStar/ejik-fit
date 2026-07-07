import type { DashboardJob } from "./types";


type FitJobRowProps = {
  job: DashboardJob;
  selected: boolean;
  onSelect: (jobId: string) => void;
};


export function FitJobRow({ job, selected, onSelect }: FitJobRowProps) {
  return (
    <li>
      <button
        className={`fit-job-row ${selected ? "is-selected" : ""}`}
        type="button"
        aria-pressed={selected}
        aria-label={`${job.companyName} ${job.title} 상세 보기`}
        onClick={() => onSelect(job.id)}
      >
        <span className="fit-job-row__main">
          <strong>{job.companyName}</strong>
          <span>{job.title}</span>
        </span>
        <span className="fit-job-row__meta">
          {job.fitScore > 0 ? `Fit ${job.fitScore}%` : "신규"}
          <span aria-hidden="true">·</span>
          {job.freshnessLabel}
          <span aria-hidden="true">·</span>
          {job.statusLabel}
        </span>
        <span className="fit-job-row__skills" aria-label="매칭 기술">
          {job.matchedSkills.length > 0
            ? job.matchedSkills.slice(0, 3).map((skill) => (
                <b key={skill}>{skill}</b>
              ))
            : <b>조건 확인</b>}
        </span>
      </button>
    </li>
  );
}
