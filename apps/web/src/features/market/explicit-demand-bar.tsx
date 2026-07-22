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
        {skill.categoryLabel}, 명시 요구 {skill.explicitCount}건, 필수{" "}
        {skill.requiredCount}건, 우대 {skill.preferredCount}건, 전체 등장{" "}
        {skill.postingCount}건, 구분 안 됨 {skill.unspecifiedCount}건, 현재 1위
        대비 막대 길이 {skill.relativeExplicitDemand}%
      </span>
      <span aria-hidden="true" className={styles.explicitDemandTrack}>
        <span
          className={styles.explicitDemandFill}
          style={{ width: `${skill.relativeExplicitDemand}%` }}
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
        <span>구분 안 됨 {skill.unspecifiedCount.toLocaleString("ko-KR")}건</span>
      </span>
    </div>
  );
}
