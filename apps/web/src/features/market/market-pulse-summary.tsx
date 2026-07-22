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
  leader,
  postingTotal,
  skillTotal,
  trendResource,
  verifiedLabel,
}: {
  leader: PulseSkill | undefined;
  postingTotal: number | null;
  skillTotal: number | null;
  trendResource: MarketTrendResource;
  verifiedLabel: string;
}) {
  const postingLabel =
    postingTotal === null
      ? "확인 불가"
      : `${postingTotal.toLocaleString("ko-KR")}건`;
  const skillLabel =
    skillTotal === null
      ? "확인 불가"
      : `${skillTotal.toLocaleString("ko-KR")}종`;

  return (
    <section aria-label="현재 채용시장 요약" className={styles.pulsePanel}>
      <div className={styles.pulsePrimary}>
        <span>명시 요구 1위</span>
        <strong>
          {leader
            ? `${leader.name} · ${leader.explicitCount.toLocaleString("ko-KR")}건`
            : "확인 불가"}
        </strong>
        <small>필수·우대 명시</small>
      </div>
      <div>
        <span>분석 범위</span>
        <strong>{postingLabel} · {skillLabel}</strong>
        <small>공고 · 기술</small>
      </div>
      <div>
        <span>주간 변화</span>
        <strong>{trendLabel(trendResource)}</strong>
        <small>{verifiedLabel} 기준</small>
      </div>
    </section>
  );
}
