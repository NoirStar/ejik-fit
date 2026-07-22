import styles from "@/features/market/market-overview.module.css";

function SkeletonLine({ width = "100%" }: { width?: string }) {
  return <span className={styles.skeletonLine} style={{ width }} />;
}

function SkillRowSkeleton() {
  return (
    <li className={styles.skeletonSkillRow} data-skeleton-skill-row>
      <span className={styles.skeletonIcon} />
      <div>
        <SkeletonLine width="42%" />
        <SkeletonLine width="76%" />
      </div>
      <SkeletonLine width="3rem" />
    </li>
  );
}

export default function MarketLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="채용 시장 데이터를 불러오는 중"
      className={`${styles.page} ${styles.loadingPage}`}
    >
      <header className={styles.intro}>
        <h1>지금 채용 시장의 기술 흐름</h1>
        <p>기업 공식 채용 공고의 기술 수요를 정리하고 있습니다.</p>
      </header>

      <div aria-hidden="true">
        <div className={styles.skeletonNotice}>
          <SkeletonLine width="58%" />
          <SkeletonLine width="82%" />
        </div>

        <div className={styles.skeletonPulse}>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index}>
              <SkeletonLine width="48%" />
              <SkeletonLine width="70%" />
            </div>
          ))}
        </div>

        <div className={styles.skeletonFilters}>
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} />
          ))}
        </div>

        <div className={styles.dashboardGrid}>
          <section className={styles.demandPanel}>
            <div className={styles.skeletonPanelHeader}>
              <SkeletonLine width="28%" />
              <SkeletonLine width="56%" />
            </div>
            <ol className={styles.skillList}>
              {Array.from({ length: 8 }, (_, index) => (
                <SkillRowSkeleton key={index} />
              ))}
            </ol>
          </section>

          <aside className={styles.sideColumn} data-skeleton-side-panel>
            <section className={`${styles.sidePanel} ${styles.skeletonSidePanel}`}>
              <SkeletonLine width="46%" />
              <SkeletonLine width="100%" />
              <SkeletonLine width="100%" />
              <SkeletonLine width="72%" />
            </section>
            <section className={`${styles.sidePanel} ${styles.skeletonSidePanel}`}>
              <SkeletonLine width="52%" />
              <SkeletonLine width="88%" />
              <SkeletonLine width="82%" />
              <SkeletonLine width="66%" />
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
