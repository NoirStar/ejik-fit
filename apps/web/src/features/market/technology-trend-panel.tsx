"use client";

import {
  ChartLine,
  ClockCounterClockwise,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useMemo } from "react";

import type { SkillTrendSeries } from "@/lib/types";
import { MARKET_TREND_COLORS } from "@/styles/design-tokens";

import {
  explicitTrendCount,
  latestExplicitTrendDelta,
  type MarketTrendResource,
} from "./market-trend";
import styles from "./market-overview.module.css";
import { TechnologyIcon } from "./technology-icon";

type TrendSkillOption = {
  category: string;
  name: string;
};

const TREND_COPY = {
  loading: "주간 추세를 불러오고 있습니다.",
  unavailable:
    "비교할 기술을 확인할 수 없어 주간 추세를 표시하지 않습니다.",
  insufficient: (collectedWeeks: number, requiredWeeks: number) =>
    `${collectedWeeks}주치 데이터가 쌓였습니다. ${requiredWeeks}주부터 변화선을 표시합니다.`,
  error:
    "주간 추세를 불러오지 못했습니다. 기술 수요와 관련 공고는 정상적으로 표시됩니다.",
  errorWithoutRelatedJobs:
    "주간 추세를 불러오지 못했습니다. 기술 수요는 정상적으로 표시됩니다.",
};

function formatWeek(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function formatDelta(delta: number) {
  if (delta === 0) return "변화 없음";
  return `전주 대비 ${delta > 0 ? "+" : ""}${delta.toLocaleString("ko-KR")}건`;
}

function TrendChart({ series }: { series: SkillTrendSeries[] }) {
  const width = 320;
  const height = 154;
  const padding = { top: 12, right: 10, bottom: 24, left: 30 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const pointCount = Math.max(...series.map((item) => item.points.length), 1);
  const maximum = Math.max(
    ...series.flatMap((item) => item.points.map(explicitTrendCount)),
    1,
  );
  const firstWeek = series[0]?.points[0]?.week_start;
  const lastWeek = series[0]?.points.at(-1)?.week_start;
  const x = (index: number) =>
    padding.left +
    (pointCount === 1 ? plotWidth / 2 : (index / (pointCount - 1)) * plotWidth);
  const y = (count: number) =>
    padding.top + plotHeight - (count / maximum) * plotHeight;

  return (
    <div className={styles.trendChartWrap}>
      <svg
        aria-label={`최근 ${pointCount}개 주차 명시 요구 변화`}
        className={styles.trendChart}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const lineY = padding.top + plotHeight * ratio;
          return (
            <line
              className={styles.trendGridLine}
              key={ratio}
              x1={padding.left}
              x2={width - padding.right}
              y1={lineY}
              y2={lineY}
            />
          );
        })}
        <text
          className={styles.trendAxisLabel}
          x={padding.left - 5}
          y={padding.top + 4}
        >
          {maximum}
        </text>
        <text
          className={styles.trendAxisLabel}
          x={padding.left - 5}
          y={padding.top + plotHeight + 4}
        >
          0
        </text>
        {series.map((item, seriesIndex) => {
          const color =
            MARKET_TREND_COLORS[seriesIndex] ?? MARKET_TREND_COLORS[0];
          const path = item.points
            .map((point, index) => {
              const command = index === 0 ? "M" : "L";
              return `${command}${x(index).toFixed(1)},${y(
                explicitTrendCount(point),
              ).toFixed(1)}`;
            })
            .join(" ");
          return (
            <g key={item.skill}>
              <path
                data-trend-line
                d={path}
                fill="none"
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.25"
                vectorEffect="non-scaling-stroke"
              />
              {item.points.map((point, index) => {
                const count = explicitTrendCount(point);
                return (
                  <circle
                    cx={x(index)}
                    cy={y(count)}
                    fill={color}
                    key={point.week_start}
                    r="2.6"
                  >
                    <title>
                      {item.skill} · {formatWeek(point.week_start)} · 명시 요구{" "}
                      {count}건
                    </title>
                  </circle>
                );
              })}
            </g>
          );
        })}
        {firstWeek && (
          <text
            className={styles.trendDateLabel}
            x={padding.left}
            y={height - 5}
          >
            {formatWeek(firstWeek)}
          </text>
        )}
        {lastWeek && (
          <text
            className={styles.trendDateLabel}
            textAnchor="end"
            x={width - padding.right}
            y={height - 5}
          >
            {formatWeek(lastWeek)}
          </text>
        )}
      </svg>
      <ul
        aria-label="기술별 최신 명시 요구"
        className={styles.trendLatestValues}
      >
        {series.map((item, index) => {
          const delta = latestExplicitTrendDelta(item);
          return (
            <li key={item.skill}>
              <span>
                <i style={{ backgroundColor: MARKET_TREND_COLORS[index] }} />
                {item.skill}
              </span>
              <strong>
                {delta
                  ? `${delta.current.toLocaleString("ko-KR")}건`
                  : "확인 중"}
              </strong>
              <small>{delta ? formatDelta(delta.delta) : "전주 비교 대기"}</small>
            </li>
          );
        })}
      </ul>
      <table className={styles.srOnly}>
        <caption>주차별 기술 명시 요구</caption>
        <tbody>
          {series.flatMap((item) =>
            item.points.map((point) => (
              <tr key={`${item.skill}-${point.week_start}`}>
                <th>{item.skill}</th>
                <td>{point.week_start}</td>
                <td>{explicitTrendCount(point)}건</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TechnologyTrendPanel({
  availableSkills,
  comparedSkills,
  filterIsActive,
  onAddSkill,
  onRemoveSkill,
  onRetry,
  relatedJobsAvailable,
  resource,
  trendUnavailable,
}: {
  availableSkills: TrendSkillOption[];
  comparedSkills: string[];
  filterIsActive: boolean;
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  onRetry: () => void;
  relatedJobsAvailable: boolean;
  resource: MarketTrendResource;
  trendUnavailable: boolean;
}) {
  const categories = useMemo(
    () => new Map(availableSkills.map((skill) => [skill.name, skill.category])),
    [availableSkills],
  );
  const addableSkills = availableSkills.filter(
    (skill) => !comparedSkills.includes(skill.name),
  );
  const trendReady =
    resource.status === "ready" &&
    resource.data.status === "ready" &&
    resource.data.collected_weeks >= resource.data.minimum_weeks &&
    resource.data.series.length > 0;
  const badgeLabel = trendReady
    ? "주간 추세"
    : trendUnavailable
      ? "표시 안 함"
      : resource.status === "error"
        ? "확인 불가"
        : "추세 수집 중";

  return (
    <section
      aria-labelledby="technology-trend-title"
      className={styles.sidePanel}
      role="region"
    >
      <header className={styles.sideHeader}>
        <div>
          <h2 id="technology-trend-title">기술 수요 추세</h2>
          <span>최근 12주 · 주간 공고</span>
        </div>
        <span
          className={styles.collectingBadge}
          data-ready={trendReady || undefined}
        >
          <ClockCounterClockwise aria-hidden="true" size={13} />
          {badgeLabel}
        </span>
      </header>
      <p className={styles.trendScope}>
        <span>전체 경력·전체 분야 기준</span>
        {filterIsActive ? <small> · 위 필터와 별도</small> : null}
      </p>

      <div className={styles.trendControls}>
        <div className={styles.trendSkills}>
          {comparedSkills.map((skill, index) => (
            <span className={styles.trendSkillChip} key={skill}>
              <i style={{ backgroundColor: MARKET_TREND_COLORS[index] }} />
              <TechnologyIcon
                category={categories.get(skill) ?? "other"}
                name={skill}
                size={18}
              />
              <span>{skill}</span>
              {index > 0 && (
                <button
                  aria-label={`${skill} 비교에서 제외`}
                  onClick={() => onRemoveSkill(skill)}
                  type="button"
                >
                  <X aria-hidden="true" size={12} weight="bold" />
                </button>
              )}
            </span>
          ))}
        </div>
        <label className={styles.trendAddControl}>
          <span className={styles.srOnly}>비교할 기술 추가</span>
          <select
            aria-label="비교할 기술 추가"
            disabled={comparedSkills.length >= 3 || addableSkills.length === 0}
            onChange={(event) => {
              const next = event.target.value;
              if (next) onAddSkill(next);
              event.target.value = "";
            }}
            value=""
          >
            <option value="">
              {comparedSkills.length >= 3 ? "최대 3개 비교" : "+ 기술 비교"}
            </option>
            {addableSkills.slice(0, 12).map((skill) => (
              <option key={skill.name} value={skill.name}>
                {skill.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {trendReady ? (
        <TrendChart series={resource.data.series} />
      ) : trendUnavailable ? (
        <div className={styles.collectingState}>
          <ChartLine aria-hidden="true" size={24} weight="duotone" />
          <strong>{TREND_COPY.unavailable}</strong>
        </div>
      ) : resource.status === "error" ? (
        <div className={styles.collectingState}>
          <WarningCircle aria-hidden="true" size={24} weight="duotone" />
          <strong>
            {relatedJobsAvailable
              ? TREND_COPY.error
              : TREND_COPY.errorWithoutRelatedJobs}
          </strong>
          <button onClick={onRetry} type="button">
            다시 시도
          </button>
        </div>
      ) : (
        <div className={styles.collectingState}>
          <ChartLine aria-hidden="true" size={24} weight="duotone" />
          <strong>
            {resource.status === "ready"
              ? TREND_COPY.insufficient(
                  resource.data.collected_weeks,
                  resource.data.minimum_weeks,
                )
              : TREND_COPY.loading}
          </strong>
        </div>
      )}
      <p className={styles.panelFootnote}>
        수집된 공고만 사용하며 빠진 주차를 임의로 채우지 않습니다.
      </p>
    </section>
  );
}
