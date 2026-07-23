import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
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
          <h1 id="login-title">로그인</h1>
        </header>
        {errorValue === "callback" && (
          <p className={styles.callbackError} role="alert">
            인증 링크를 사용할 수 없습니다. 로그인하거나 새 링크를 받아 주세요.
          </p>
        )}
        <AuthPanel initialMode={initialMode} nextPath={nextPath} />
      </section>
    </main>
  );
}
