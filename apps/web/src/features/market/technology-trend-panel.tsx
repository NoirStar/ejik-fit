"use client";

import {
  ChartLine,
  ClockCounterClockwise,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import type { SkillTrendResponse, SkillTrendSeries } from "@/lib/types";
import { MARKET_TREND_COLORS } from "@/styles/design-tokens";

import styles from "./market-overview.module.css";
import { TechnologyIcon } from "./technology-icon";

type TrendSkillOption = {
  category: string;
  name: string;
};

type TrendResource =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: SkillTrendResponse };

function formatWeek(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function TrendChart({ series }: { series: SkillTrendSeries[] }) {
  const width = 320;
  const height = 154;
  const padding = { top: 12, right: 10, bottom: 24, left: 30 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const pointCount = Math.max(...series.map((item) => item.points.length), 1);
  const maximum = Math.max(
    ...series.flatMap((item) => item.points.map((point) => point.count)),
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
        aria-label={`최근 ${pointCount}개 주차 기술 수요 변화`}
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
        <text className={styles.trendAxisLabel} x={padding.left - 5} y={padding.top + 4}>
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
          const color = MARKET_TREND_COLORS[seriesIndex] ?? MARKET_TREND_COLORS[0];
          const path = item.points
            .map((point, index) => {
              const command = index === 0 ? "M" : "L";
              return `${command}${x(index).toFixed(1)},${y(point.count).toFixed(1)}`;
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
              {item.points.map((point, index) => (
                <circle
                  cx={x(index)}
                  cy={y(point.count)}
                  fill={color}
                  key={point.week_start}
                  r="2.6"
                >
                  <title>
                    {item.skill} · {formatWeek(point.week_start)} · {point.count}건
                  </title>
                </circle>
              ))}
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
      <ul aria-label="기술별 최신 수요" className={styles.trendLatestValues}>
        {series.map((item, index) => (
          <li key={item.skill}>
            <span>
              <i style={{ backgroundColor: MARKET_TREND_COLORS[index] }} />
              {item.skill}
            </span>
            <strong>{item.points.at(-1)?.count ?? 0}건</strong>
          </li>
        ))}
      </ul>
      <table className={styles.srOnly}>
        <caption>주차별 기술 수요</caption>
        <tbody>
          {series.flatMap((item) =>
            item.points.map((point) => (
              <tr key={`${item.skill}-${point.week_start}`}>
                <th>{item.skill}</th>
                <td>{point.week_start}</td>
                <td>{point.count}건</td>
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
  selectedSkill,
}: {
  availableSkills: TrendSkillOption[];
  selectedSkill: string;
}) {
  const [comparedSkills, setComparedSkills] = useState<string[]>(
    selectedSkill ? [selectedSkill] : [],
  );
  const [resource, setResource] = useState<TrendResource>({ status: "loading" });
  const categories = useMemo(
    () => new Map(availableSkills.map((skill) => [skill.name, skill.category])),
    [availableSkills],
  );
  const comparisonKey = comparedSkills.join("\u0000");

  useEffect(() => {
    if (!selectedSkill) return;
    setComparedSkills((current) => [
      selectedSkill,
      ...current.filter((skill) => skill !== selectedSkill),
    ].slice(0, 3));
  }, [selectedSkill]);

  useEffect(() => {
    if (comparedSkills.length === 0) {
      setResource({ status: "loading" });
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    for (const skill of comparedSkills) params.append("skills", skill);
    setResource({ status: "loading" });
    void fetch(`/market/trend-data?${params.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`trend request failed: ${response.status}`);
        return response.json() as Promise<SkillTrendResponse>;
      })
      .then((data) => setResource({ status: "ready", data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResource({ status: "error" });
      });
    return () => controller.abort();
  }, [comparisonKey]);

  const addableSkills = availableSkills.filter(
    (skill) => !comparedSkills.includes(skill.name),
  );
  const trendReady =
    resource.status === "ready" &&
    resource.data.status === "ready" &&
    resource.data.series.length > 0;

  return (
    <section
      aria-labelledby="technology-trend-title"
      className={styles.sidePanel}
      role="region"
    >
      <header className={styles.sideHeader}>
        <div>
          <h2 id="technology-trend-title">기술 수요 추세</h2>
          <span>최근 12주 · 공식 공고 기준</span>
        </div>
        <span className={styles.collectingBadge} data-ready={trendReady || undefined}>
          <ClockCounterClockwise aria-hidden="true" size={13} />
          {trendReady ? "주간 추세" : "추세 수집 중"}
        </span>
      </header>

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
                  onClick={() =>
                    setComparedSkills((current) =>
                      current.filter((item) => item !== skill),
                    )
                  }
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
              if (next) {
                setComparedSkills((current) => [...current, next].slice(0, 3));
              }
              event.target.value = "";
            }}
            value=""
          >
            <option value="">
              {comparedSkills.length >= 3 ? "최대 3개 비교" : "+ 기술 비교"}
            </option>
            {addableSkills.slice(0, 12).map((skill) => (
              <option key={skill.name} value={skill.name}>{skill.name}</option>
            ))}
          </select>
        </label>
      </div>

      {trendReady ? (
        <TrendChart series={resource.data.series} />
      ) : resource.status === "error" ? (
        <div className={styles.collectingState}>
          <WarningCircle aria-hidden="true" size={24} weight="duotone" />
          <strong>추세 수집 상태를 불러오지 못했어요.</strong>
          <p>현재 수요 순위와 공고는 계속 확인할 수 있습니다.</p>
        </div>
      ) : (
        <div className={styles.collectingState}>
          <ChartLine aria-hidden="true" size={24} weight="duotone" />
          <strong>주간 데이터를 수집하고 있어요.</strong>
          <p>
            {resource.status === "ready"
              ? `현재 ${resource.data.collected_weeks}/${resource.data.minimum_weeks}주차입니다. 최소 ${resource.data.minimum_weeks}주가 쌓이면 실제 변화선을 표시합니다.`
              : "현재 수집 주차를 확인하고 있습니다."}
          </p>
        </div>
      )}
      <p className={styles.panelFootnote}>
        실제 공식 공고 스냅샷만 사용하며, 누락된 주차나 예시 수치를 채워 넣지 않습니다.
      </p>
    </section>
  );
}
