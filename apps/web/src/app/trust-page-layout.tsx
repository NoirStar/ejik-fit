import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./trust-pages.module.css";

type TrustPageLayoutProps = {
  title: string;
  intro: string;
  children: ReactNode;
};

export function TrustPageLayout({ title, intro, children }: TrustPageLayoutProps) {
  return (
    <main className={styles.main}>
      <Link className={styles.backLink} href="/">홈으로 돌아가기</Link>
      <header className={styles.header}>
        <p>이직핏 운영 원칙</p>
        <h1>{title}</h1>
        <span>{intro}</span>
      </header>
      <article className={styles.content}>{children}</article>
    </main>
  );
}
