import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { ReactNode } from "react";

import styles from "./route-shell.module.css";

type RouteShellProps = {
  action?: ReactNode;
  children?: ReactNode;
  description: string;
  eyebrow?: string;
  statusLabel?: string;
  title: string;
};

export function RouteShell({
  action,
  children,
  description,
  eyebrow = "이직핏",
  statusLabel = "준비 중",
  title,
}: RouteShellProps) {
  return (
    <main className={styles.main}>
      <section className={styles.panel}>
        <header className={styles.header}>
          <div className={styles.metaRow}>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <span className={styles.status}>
              <span aria-hidden="true" />
              {statusLabel}
            </span>
          </div>
          <h1>{title}</h1>
          <p className={styles.description}>{description}</p>
        </header>

        {children && <div className={styles.body}>{children}</div>}

        <nav aria-label={`${title} 다음 이동`} className={styles.actions}>
          {action && (
            <div className={styles.primaryAction}>
              {action}
              <ArrowRight aria-hidden="true" size={17} weight="bold" />
            </div>
          )}
          <Link className={styles.homeLink} href="/">
            <ArrowLeft aria-hidden="true" size={17} />
            홈으로 돌아가기
          </Link>
        </nav>
      </section>
    </main>
  );
}
