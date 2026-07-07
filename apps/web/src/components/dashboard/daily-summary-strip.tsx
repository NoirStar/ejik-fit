import type { DashboardSummary } from "./types";


type DailySummaryStripProps = {
  summary: DashboardSummary;
};


const SUMMARY_ITEMS = [
  {
    key: "matchedJobCount",
    label: "새 맞춤 공고",
  },
  {
    key: "highFitJobCount",
    label: "높은 Fit",
  },
  {
    key: "gapSkillCount",
    label: "보완 기술",
  },
  {
    key: "actionItemCount",
    label: "오늘 확인",
  },
] as const;


export function DailySummaryStrip({ summary }: DailySummaryStripProps) {
  return (
    <section className="daily-summary" aria-label="오늘 요약">
      {SUMMARY_ITEMS.map((item) => (
        <article className="daily-summary-card" key={item.key}>
          <span>{item.label}</span>
          <strong>{summary[item.key]}</strong>
        </article>
      ))}
    </section>
  );
}
