"use client";

import Link from "next/link";

type ErrorPageProps = {
  error: Error & { digest?: string };
  reset(): void;
};

export default function ErrorPage({ reset }: ErrorPageProps) {
  return (
    <main className="not-found">
      <h1>페이지를 불러오지 못했습니다.</h1>
      <p>다시 시도하거나 홈으로 이동해 주세요.</p>
      <div className="not-found__actions">
        <button
          className="not-found__primary"
          onClick={reset}
          type="button"
        >
          다시 시도
        </button>
        <Link href="/">홈으로</Link>
        <Link href="/data-policy">데이터 정책</Link>
      </div>
    </main>
  );
}
