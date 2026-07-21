import { ArrowLeft, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";

import { AuthPanel } from "@/features/auth/auth-panel";
import { normalizeCredentialAuthMode } from "@/features/auth/auth-credentials";
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
    mode?: string | string[];
    next?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const errorValue = Array.isArray(params.error) ? params.error[0] : params.error;
  const modeValue = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const nextPath = safeAuthNextPath(nextValue);
  const initialMode = normalizeCredentialAuthMode(modeValue);

  return (
    <main className={styles.page}>
      <section aria-labelledby="login-title" className={styles.panel}>
        <Link className={styles.back} href={nextPath}>
          <ArrowLeft aria-hidden="true" size={17} />
          돌아가기
        </Link>
        <header className={styles.header}>
          <h1 id="login-title">이직핏 계정</h1>
          <p>
            이메일 확인으로 계정을 보호하고 내 커리어 정보를 여러 기기에서
            이어보세요.
          </p>
        </header>

        {errorValue === "callback" && (
          <p className={styles.callbackError} role="alert">
            인증 링크를 확인하지 못했습니다. 다시 로그인하거나 새 링크를
            요청해주세요.
          </p>
        )}

        <AuthPanel initialMode={initialMode} nextPath={nextPath} />

        <div className={styles.scope}>
          <strong>로그인하면 달라지는 점</strong>
          <ul>
            <li><CheckCircle aria-hidden="true" size={17} />다른 기기에서도 내 스택 확인</li>
            <li><CheckCircle aria-hidden="true" size={17} />저장 공고와 지원 단계 이어보기</li>
          </ul>
          <p>
            현재 브라우저의 커리어 정보는 로그인 후 계정 정보와 합쳐집니다.
            저장 범위는 <Link href="/privacy">개인정보 안내</Link>에서 확인할 수
            있습니다.
          </p>
        </div>
      </section>
    </main>
  );
}
