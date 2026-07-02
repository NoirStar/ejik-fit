import Link from "next/link";


export default function NotFound() {
  return (
    <main className="not-found">
      <h1>공고를 찾을 수 없습니다.</h1>
      <p>마감되었거나 주소가 바뀐 공고일 수 있습니다.</p>
      <Link href="/">공고 목록으로 돌아가기</Link>
    </main>
  );
}
