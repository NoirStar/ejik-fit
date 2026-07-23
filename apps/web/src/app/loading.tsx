import styles from "@/features/home-feed/home-feed.module.css";

function RailSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true" className={styles.skeletonRailCard}>
      <span className={styles.skeletonTitle} />
      {Array.from({ length: rows }, (_, index) => (
        <span className={styles.skeletonLine} key={index} />
      ))}
    </div>
  );
}

function FeedSkeleton() {
  return (
    <div aria-hidden="true" className={styles.skeletonCard}>
      <div className={styles.skeletonIdentity}>
        <span className={styles.skeletonAvatar} />
        <div>
          <span className={styles.skeletonShortLine} />
          <span className={styles.skeletonShortLine} />
        </div>
      </div>
      <span className={styles.skeletonTitle} />
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonLine} />
      <span className={styles.skeletonHalfLine} />
      <div className={styles.skeletonActions}>
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-label="홈 피드를 불러오는 중"
      className={`${styles.page} ${styles.loadingPage}`}
    >
      <div className={styles.layout}>
        <aside aria-label="내 커리어를 불러오는 중" className={styles.leftRail}>
          <RailSkeleton rows={3} />
          <RailSkeleton rows={4} />
        </aside>

        <section aria-label="피드를 불러오는 중" className={styles.feedColumn}>
          <div aria-hidden="true" className={styles.skeletonFeedHeader}>
            <span className={styles.skeletonTitle} />
            <span className={styles.skeletonHalfLine} />
          </div>
          <div aria-hidden="true" className={styles.skeletonTabs}>
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className={styles.feedList}>
            <FeedSkeleton />
            <FeedSkeleton />
            <FeedSkeleton />
          </div>
        </section>

        <aside aria-label="채용 시장 요약을 불러오는 중" className={styles.rightRail}>
          <RailSkeleton rows={5} />
          <RailSkeleton rows={4} />
          <RailSkeleton rows={3} />
        </aside>
      </div>
    </main>
  );
}
