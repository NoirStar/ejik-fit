import styles from "@/features/hiring-calendar/hiring-calendar.module.css";

export default function HiringCalendarLoading() {
  return (
    <main aria-busy="true" aria-label="채용 일정 불러오는 중…" className={styles.page}>
      <div className={styles.loadingIntro}>
        <span />
        <span />
      </div>
      <div className={styles.loadingNotice} />
      <div className={styles.loadingSummary}>
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} />
        ))}
      </div>
      <div className={styles.loadingWorkspace}>
        <div className={styles.loadingCalendar} />
        <div className={styles.loadingSide} />
      </div>
      <span className={styles.srOnly}>공식 공고의 명시 마감일을 불러오는 중…</span>
    </main>
  );
}
