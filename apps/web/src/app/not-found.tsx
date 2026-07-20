import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <h1>페이지를 찾을 수 없습니다.</h1>
      <p>요청한 주소가 바뀌었거나 더 이상 제공되지 않는 페이지일 수 있습니다.</p>
      <div className="not-found__actions">
        <Link className="not-found__primary" href="/">
          홈으로
        </Link>
        <Link href="/jobs">공고 둘러보기</Link>
      </div>
    </main>
  );
}
