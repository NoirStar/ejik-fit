import type { MarketSkill } from "./model";
import styles from "./market-overview.module.css";

function segmentWidth(count: number, total: number) {
  return total > 0 ? `${(count / total) * 100}%` : "0%";
}

export function ExplicitDemandBar({
  descriptionId,
  skill,
}: {
  descriptionId: string;
  skill: MarketSkill;
}) {
  return (
    <div className={styles.explicitDemand}>
      <span className={styles.srOnly} id={descriptionId}>
        {skill.categoryLabel}, 필수 또는 우대로 확인된 공고 {skill.explicitCount}건,
        필수 {skill.requiredCount}건, 우대 {skill.preferredCount}건, 이 기술이 포함된
        공고 {skill.postingCount}건, 조건 구분 없음 {skill.unspecifiedCount}건, 현재
        1위 대비 막대 길이 {skill.relativeExplicitDemand}%
      </span>
      <span aria-hidden="true" className={styles.explicitDemandTrack}>
        <span
          className={styles.explicitDemandFill}
          data-demand-fill
          style={{ transform: `scaleX(${skill.relativeExplicitDemand / 100})` }}
        >
          <i
            data-segment="required"
            style={{
              width: segmentWidth(skill.requiredCount, skill.explicitCount),
            }}
          />
          <i
            data-segment="preferred"
            style={{
              width: segmentWidth(skill.preferredCount, skill.explicitCount),
            }}
          />
        </span>
      </span>
      <span aria-hidden="true" className={styles.requirementCounts}>
        <span>필수 {skill.requiredCount.toLocaleString("ko-KR")}건</span>
        <span>우대 {skill.preferredCount.toLocaleString("ko-KR")}건</span>
        <span>조건 구분 없음 {skill.unspecifiedCount.toLocaleString("ko-KR")}건</span>
      </span>
    </div>
  );
}
