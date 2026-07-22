import type { MarketTrendResource } from "./market-trend";
import styles from "./market-overview.module.css";

type PulseSkill = { explicitCount: number; name: string };

function trendLabel(resource: MarketTrendResource) {
  if (resource.status === "loading" || resource.status === "idle") {
    return "추세 상태 확인 중";
  }
  if (resource.status === "error") return "추세 확인 불가";
  if (resource.data.status === "collecting") {
    return `${resource.data.collected_weeks}/${resource.data.minimum_weeks}주 수집 중`;
  }
  return "주간 추세 확인 가능";
}

export function MarketPulseSummary({
  postingCountLabel,
  topSkills,
  trendResource,
  verifiedLabel,
}: {
  postingCountLabel: string;
  topSkills: readonly PulseSkill[];
  trendResource: MarketTrendResource;
  verifiedLabel: string;
}) {
  const leader = topSkills[0];

  return (
    <section aria-label="현재 채용시장 요약" className={styles.pulsePanel}>
      <div className={styles.pulsePrimary}>
        <span>가장 많이 명시된 기술</span>
        <strong>
          {leader
            ? `${leader.name} · ${leader.explicitCount.toLocaleString("ko-KR")}건`
            : "확인 불가"}
        </strong>
        <small>필수·우대로 명시된 공식 공고</small>
      </div>
      <div>
        <span>명시 요구 상위</span>
        <strong>
          {topSkills.map((skill) => skill.name).join(" · ") || "확인 불가"}
        </strong>
        <small>{postingCountLabel}</small>
      </div>
      <div>
        <span>최근 변화</span>
        <strong>{trendLabel(trendResource)}</strong>
        <small>{verifiedLabel} 기준</small>
      </div>
    </section>
  );
}
