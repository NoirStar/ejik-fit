"use client";

import Link from "next/link";

import styles from "./job-detail.module.css";

export default function JobDetailError({ reset }: { reset(): void }) {
  return (
    <main className={styles.errorPage}>
      <h2>공고 상세를 불러오지 못했습니다</h2>
      <p>잠시 뒤 다시 시도하거나 공고 탐색으로 돌아가 주세요.</p>
      <div className={styles.errorActions}>
        <button onClick={reset} type="button">다시 시도</button>
        <Link href="/jobs">공고 탐색</Link>
        <Link href="/data-policy">데이터 정책</Link>
      </div>
    </main>
  );
}
