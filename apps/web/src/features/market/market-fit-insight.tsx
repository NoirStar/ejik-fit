import { ArrowRight, CheckCircle } from "@phosphor-icons/react";
import Link from "next/link";

import { withObjectParticle } from "@/lib/korean-particles";

import styles from "./market-overview.module.css";
import type { MarketFitState } from "./use-market-fit";

export function MarketFitInsight({
  fit,
}: {
  fit: MarketFitState;
}) {
  if (fit.status === "empty") {
    return (
      <section className={styles.fitPanel}>
        <div>
          <strong>내 기술을 저장하면 시장 데이터를 내 기준으로 바꿔 볼 수 있어요.</strong>
          <p>일치하는 공고와 다음 학습 후보를 실제 공고 근거로 확인합니다.</p>
        </div>
        <Link href="/career">
          내 기술 저장하기
          <ArrowRight aria-hidden="true" size={14} />
        </Link>
      </section>
    );
  }

  if (fit.status === "loading") {
    return (
      <section aria-busy="true" className={styles.fitPanel}>
        <div>
          <strong>내 기술과 공고를 비교하고 있어요.</strong>
          <p>{fit.ownedSkills.length}개 저장 기술 기준</p>
        </div>
      </section>
    );
  }

  if (fit.status === "error") {
    return (
      <section className={styles.fitPanel}>
        <div>
          <strong>내 기술 분석을 잠시 불러오지 못했습니다.</strong>
          <p>시장 수요와 공식 공고는 계속 확인할 수 있습니다.</p>
        </div>
        <Link href="/career">내 커리어에서 다시 보기</Link>
      </section>
    );
  }

  const next = fit.data.recommended_next_skills[0];
  return (
    <section className={styles.fitPanel}>
      <CheckCircle aria-hidden="true" size={22} weight="duotone" />
      <div>
        <strong>
          내 기술과 하나 이상 일치하는 공고 {fit.data.coverage.matching_posting_count}건
        </strong>
        <p>
          {next
            ? `${withObjectParticle(next.skill)} 요구하는 공고 ${next.supporting_posting_count}건을 다음 학습 후보로 살펴보세요.`
            : "현재 저장 기술과 연결된 공고 근거를 확인해 보세요."}
        </p>
      </div>
      <Link href="/career">자세히 보기</Link>
    </section>
  );
}
