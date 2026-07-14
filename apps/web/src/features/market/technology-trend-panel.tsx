import { ChartLine, ClockCounterClockwise } from "@phosphor-icons/react";

import styles from "./market-overview.module.css";
import { TechnologyIcon } from "./technology-icon";

export function TechnologyTrendPanel({
  category,
  selectedSkill,
}: {
  category: string;
  selectedSkill: string;
}) {
  return (
    <section
      aria-labelledby="technology-trend-title"
      className={styles.sidePanel}
      role="region"
    >
      <header className={styles.sideHeader}>
        <div>
          <h2 id="technology-trend-title">기술 수요 추세</h2>
          <span>최근 12주</span>
        </div>
        <span className={styles.collectingBadge}>
          <ClockCounterClockwise aria-hidden="true" size={13} />
          추세 수집 중
        </span>
      </header>
      <div className={styles.trendSelection}>
        {selectedSkill ? (
          <span>
            <TechnologyIcon category={category} name={selectedSkill} size={22} />
            {selectedSkill}
          </span>
        ) : null}
        <span className={styles.compareLimit}>최대 3개 비교</span>
      </div>
      <div className={styles.collectingState}>
        <ChartLine aria-hidden="true" size={24} weight="duotone" />
        <strong>주간 데이터를 수집하고 있어요.</strong>
        <p>
          데이터가 충분히 쌓이면 선택한 기술의 최근 12주의 변화를 확인할 수 있습니다.
        </p>
      </div>
      <p className={styles.panelFootnote}>
        실제 공식 공고 스냅샷만 사용하며 예시 수치는 노출하지 않습니다.
      </p>
    </section>
  );
}
