import { ArrowLeft, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/features/auth/login-form";
import { safeAuthNextPath } from "@/lib/auth/redirect";

import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "로그인",
  description: "이직핏에 로그인해 내 커리어 정보를 이어서 확인합니다.",
  robots: { index: false, follow: false },
};

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const errorValue = Array.isArray(params.error) ? params.error[0] : params.error;
  const nextPath = safeAuthNextPath(nextValue);

  return (
    <main className={styles.page}>
      <section aria-labelledby="login-title" className={styles.panel}>
        <Link className={styles.back} href={nextPath}>
          <ArrowLeft aria-hidden="true" size={17} />
          돌아가기
        </Link>
        <header className={styles.header}>
          <h1 id="login-title">내 커리어를 이어서 관리하세요</h1>
          <p>이메일 링크로 로그인합니다. 별도 비밀번호는 만들지 않습니다.</p>
        </header>

        {errorValue === "callback" && (
          <p className={styles.callbackError} role="alert">
            로그인 링크를 확인하지 못했습니다. 새 링크를 요청해주세요.
          </p>
        )}

        <LoginForm nextPath={nextPath} />

        <div className={styles.scope}>
          <strong>로그인하면 달라지는 점</strong>
          <ul>
            <li><CheckCircle aria-hidden="true" size={17} />다른 기기에서도 내 스택 확인</li>
            <li><CheckCircle aria-hidden="true" size={17} />저장 공고와 지원 단계 이어보기</li>
          </ul>
          <p>
            현재 브라우저에 저장된 값은 로그인 과정에서 지우지 않습니다. 자세한
            내용은 <Link href="/privacy">개인정보 안내</Link>에서 확인할 수 있습니다.
          </p>
        </div>
      </section>
    </main>
  );
}
