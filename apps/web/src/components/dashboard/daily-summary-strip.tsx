import type { DashboardSummary } from "./types";


type DailySummaryStripProps = {
  summary: DashboardSummary;
};


const SUMMARY_ITEMS = [
  {
    key: "matchedJobCount",
    label: "새 맞춤 공고",
    caption: "내 스택과 연결",
    delta: "+ 오늘",
  },
  {
    key: "highFitJobCount",
    label: "높은 Fit",
    caption: "우선 확인 대상",
    delta: "80%+",
  },
  {
    key: "gapSkillCount",
    label: "보완 기술",
    caption: "준비하면 좋은 기술",
    delta: "Gap",
  },
  {
    key: "actionItemCount",
    label: "오늘 확인",
    caption: "공고·기술 액션",
    delta: "Action",
  },
] as const;


export function DailySummaryStrip({ summary }: DailySummaryStripProps) {
  return (
    <section className="daily-summary" aria-label="오늘 요약">
      {SUMMARY_ITEMS.map((item) => (
        <article className="daily-summary-card" key={item.key}>
          <div className="daily-card-core daily-summary-card__core">
            <span>{item.label}</span>
            <strong>{summary[item.key]}</strong>
            <small>{item.caption}</small>
            <em>{item.delta}</em>
          </div>
        </article>
      ))}
    </section>
  );
}
