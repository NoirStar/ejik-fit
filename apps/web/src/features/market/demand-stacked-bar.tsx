import type { MarketSkill } from "./model";
import styles from "./market-overview.module.css";

function segmentWidth(count: number, total: number) {
  return total > 0 ? `${(count / total) * 100}%` : "0%";
}

export function DemandStackedBar({
  descriptionId,
  skill,
}: {
  descriptionId: string;
  skill: MarketSkill;
}) {
  const total =
    skill.requiredCount + skill.preferredCount + skill.unspecifiedCount;
  const segments = [
    { kind: "required", label: "필수", count: skill.requiredCount },
    { kind: "preferred", label: "우대", count: skill.preferredCount },
    { kind: "unspecified", label: "미분류", count: skill.unspecifiedCount },
  ] as const;

  return (
    <div className={styles.requirementComposition}>
      <span className={styles.srOnly} id={descriptionId}>
        {skill.categoryLabel ?? skill.category}, 공고 {skill.postingCount}건,{" "}
        {segments.map((segment) => `${segment.label} ${segment.count}건`).join(", ")},
        1위 대비 상대 수요 {Math.round(skill.relativeDemand)}%
      </span>
      <span aria-hidden="true" className={styles.stackedBar}>
        {segments.map((segment) => (
          <span
            className={styles.stackedSegment}
            data-segment={segment.kind}
            key={segment.kind}
            style={{ width: segmentWidth(segment.count, total) }}
            title={`${segment.label} ${segment.count}건`}
          >
            {segment.count > 0 ? (
              <>
                <span className={styles.segmentLabelFull}>
                  {segment.label} {segment.count}
                </span>
                <span className={styles.segmentLabelShort}>{segment.count}</span>
              </>
            ) : null}
          </span>
        ))}
      </span>
      <span className={styles.requirementCounts} aria-hidden="true">
        {segments.map((segment) => (
          <span data-count={segment.kind} key={segment.kind}>
            {segment.label} {segment.count}건
          </span>
        ))}
      </span>
    </div>
  );
}
