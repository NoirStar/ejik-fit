"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useRef } from "react";

import { DemandStackedBar } from "./demand-stacked-bar";
import {
  sortMarketSkills,
  type MarketSkill,
  type MarketSort,
} from "./model";
import styles from "./market-overview.module.css";
import { TechnologyIcon } from "./technology-icon";
import { useDemandLayoutAnimation } from "./use-demand-layout-animation";

const DEFAULT_VISIBLE_ROWS = 10;

export function TechnologyDemandTable({
  onSelect,
  selectedSkill,
  skills,
  sort,
}: {
  onSelect: (skill: string) => void;
  selectedSkill: string;
  skills: readonly MarketSkill[];
  sort: MarketSort;
}) {
  const orderedSkills = useMemo(
    () => sortMarketSkills(skills, sort),
    [skills, sort],
  );
  const visibleSkills = orderedSkills.slice(0, DEFAULT_VISIBLE_ROWS);
  const listRef = useRef<HTMLOListElement>(null);
  const layoutKey = visibleSkills.map((skill) => skill.id).join("|");
  useDemandLayoutAnimation(listRef, layoutKey);

  return (
    <section
      aria-labelledby="skill-demand-title"
      className={styles.demandPanel}
      role="region"
    >
      <header className={styles.sectionHeader}>
        <div>
          <h2 id="skill-demand-title">기술 수요 순위</h2>
          <p>기술을 선택하면 관련 공식 공고를 오른쪽에서 확인할 수 있습니다.</p>
        </div>
        <div aria-label="요구 조건 범례" className={styles.legend}>
          <span data-legend="required">필수</span>
          <span data-legend="preferred">우대</span>
          <span data-legend="unspecified">미분류</span>
        </div>
      </header>
      <p className={styles.relativeNote}>
        막대 길이는 현재 필터 결과에서 1위 기술 대비 상대적 수요를 나타냅니다.
      </p>
      <div aria-hidden="true" className={styles.tableHeader}>
        <span>순위 · 기술</span>
        <span>공고 수</span>
        <span>필수 · 우대 · 미분류</span>
        <span>상대 수요</span>
        <span />
      </div>
      <ol className={styles.skillList} ref={listRef}>
        {visibleSkills.map((skill, index) => {
          const descriptionId = `skill-demand-${skill.id.replace(/[^a-z0-9_-]/gi, "-")}`;

          return (
            <li
              className={styles.skillRow}
              data-selected={selectedSkill === skill.name}
              data-skill-row={skill.id}
              key={skill.id}
            >
              <button
                aria-describedby={descriptionId}
                aria-label={`${skill.name} 기술 선택`}
                aria-pressed={selectedSkill === skill.name}
                className={styles.skillSelect}
                onClick={() => onSelect(skill.name)}
                type="button"
              >
                <span className={styles.skillIdentity}>
                  <span className={styles.rank}>{index + 1}</span>
                  <TechnologyIcon category={skill.category} name={skill.name} />
                  <span className={styles.skillNameGroup}>
                    <strong>{skill.name}</strong>
                    <small>{skill.categoryLabel ?? skill.category}</small>
                  </span>
                </span>
                <strong className={styles.postingCount}>
                  {skill.postingCount.toLocaleString("ko-KR")}건
                </strong>
                <DemandStackedBar descriptionId={descriptionId} skill={skill} />
                <span className={styles.relativeDemand} aria-hidden="true">
                  <span style={{ width: `${skill.relativeDemand}%` }} />
                </span>
              </button>
              <Link
                aria-label={`${skill.name} 관련 공고 보기`}
                className={styles.rowAction}
                href={skill.jobsHref}
              >
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </li>
          );
        })}
      </ol>
      {skills.length > DEFAULT_VISIBLE_ROWS ? (
        <Link className={styles.showMore} href="/skill-map">
          더 많은 기술 보기 · 총 {skills.length.toLocaleString("ko-KR")}개
        </Link>
      ) : null}
    </section>
  );
}
