import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";

import type { MarketSkillCombination } from "./model";
import styles from "./market-overview.module.css";
import { TechnologyIcon } from "./technology-icon";

function combinationHref(skills: [string, string]) {
  const params = new URLSearchParams({ skill: skills[0] });
  params.append("owned_skills", skills[1]);
  return `/skill-map?${params.toString()}`;
}

export function SkillCombinationRecommendations({
  combinations,
  unavailable = false,
}: {
  combinations: readonly MarketSkillCombination[];
  unavailable?: boolean;
}) {
  return (
    <section
      aria-labelledby="skill-combinations-title"
      className={styles.combinationPanel}
      role="region"
    >
      <header className={styles.combinationHeader}>
        <div>
          <h2 id="skill-combinations-title">함께 등장한 기술</h2>
          <p>
            {unavailable
              ? "공고 데이터 연결 상태를 확인하고 있습니다."
              : "현재 불러온 공고에서 같은 공고에 함께 나온 횟수입니다."}
          </p>
        </div>
        <Link href="/skill-map">스킬맵에서 탐색</Link>
      </header>
      {unavailable ? (
        <p className={styles.combinationEmpty}>
          공고 데이터를 불러오지 못해 함께 등장한 기술을 확인할 수 없습니다.
        </p>
      ) : combinations.length === 0 ? (
        <p className={styles.combinationEmpty}>
          현재 조건에서는 반복해서 함께 등장한 기술 조합이 없습니다.
        </p>
      ) : (
        <ul className={styles.combinationList}>
          {combinations.map((combination) => (
            <li key={combination.id}>
              <Link href={combinationHref(combination.skills)}>
                <span className={styles.combinationSkills}>
                  <TechnologyIcon category="tool" name={combination.skills[0]} size={22} />
                  <strong>{combination.skills.join(" + ")}</strong>
                </span>
                <span>함께 등장한 공고 {combination.postingCount}건</span>
                <ArrowRight aria-hidden="true" size={14} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
