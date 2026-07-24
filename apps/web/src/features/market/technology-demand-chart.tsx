"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";

import { PRODUCT_TERMS } from "@/lib/labels";

import { ExplicitDemandBar } from "./explicit-demand-bar";
import {
  sortMarketSkills,
  type MarketSkill,
  type MarketSort,
} from "./model";
import styles from "./market-overview.module.css";
import { TechnologyIcon } from "./technology-icon";
import { useDemandLayoutAnimation } from "./use-demand-layout-animation";

const DEFAULT_VISIBLE_ROWS = 8;

function descriptionId(skill: MarketSkill) {
  return `skill-demand-${skill.id.replace(/[^a-z0-9_-]/gi, "-")}`;
}

export function TechnologyDemandChart({
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
  const [expanded, setExpanded] = useState(false);
  const orderedSkills = useMemo(
    () => sortMarketSkills(skills, sort),
    [skills, sort],
  );
  const visibleSkills = expanded
    ? orderedSkills
    : orderedSkills.slice(0, DEFAULT_VISIBLE_ROWS);
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
          <h2 id="skill-demand-title">시장 기술 확산</h2>
          <p>요구한 기업 수를 먼저 보고, 필수·우대 공고 규모를 함께 비교합니다.</p>
        </div>
        <div aria-label="요구 조건 범례" className={styles.legend}>
          <span data-legend="required">필수</span>
          <span data-legend="preferred">우대</span>
          <span data-legend="unspecified">
            {PRODUCT_TERMS.unspecifiedRequirementCompact}
          </span>
        </div>
      </header>
      <div aria-hidden="true" className={styles.tableHeader}>
        <span>순위 · 기술</span>
        <span>요구 기업 · 공고</span>
        <span>필수 · 우대 · {PRODUCT_TERMS.unspecifiedRequirementCompact}</span>
        <span />
      </div>
      <ol className={styles.skillList} ref={listRef}>
        {visibleSkills.map((skill, index) => (
          <li
            className={styles.skillRow}
            data-selected={selectedSkill === skill.name}
            data-skill-row={skill.id}
            key={skill.id}
          >
            <button
              aria-describedby={descriptionId(skill)}
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
                  <small>{skill.categoryLabel}</small>
                </span>
              </span>
              <span className={styles.breadthCount}>
                <strong>
                  요구 기업 {skill.companyCount.toLocaleString("ko-KR")}곳
                </strong>
                <small>공고 {skill.postingCount.toLocaleString("ko-KR")}건</small>
              </span>
              <ExplicitDemandBar
                descriptionId={descriptionId(skill)}
                skill={skill}
              />
            </button>
            <Link
              aria-label={`${skill.name} 관련 공고 보기`}
              className={styles.rowAction}
              href={skill.jobsHref}
              prefetch={false}
            >
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </li>
        ))}
      </ol>
      {skills.length > DEFAULT_VISIBLE_ROWS ? (
        <button
          className={styles.showMore}
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded
            ? "상위 8개만 보기"
            : `전체 ${skills.length.toLocaleString("ko-KR")}개 기술 보기`}
        </button>
      ) : null}
    </section>
  );
}
