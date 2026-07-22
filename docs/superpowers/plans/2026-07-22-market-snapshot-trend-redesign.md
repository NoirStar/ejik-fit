# Market Snapshot and Trend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn /market into a scan-first market-observation screen with an explicit-demand bar chart, honest weekly trends, evidence links, and no duplicated personal learning recommendation.

**Architecture:** Keep the server-rendered posting and skill-stat snapshot, then derive explicit demand in the pure market model. A single client hook owns the selected technologies and trend request so the pulse summary and trend panel share one resource; focused presentation components render the demand chart and selected-skill evidence.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.8, CSS Modules, Vitest 3, Testing Library 16, Playwright 1.61, existing Phosphor and Simple Icons components.

## Global Constraints

- Use only company-official posting data already returned by the existing APIs.
- Do not add a database table, API schema, chart dependency, gradient, or heavy shadow.
- The primary metric is explicit demand: required_count + preferred_count.
- Rename every user-facing occurrence of 미분류 to 구분 안 됨.
- Explain 구분 안 됨 as: 기술은 확인됐지만 원문에서 필수·우대 여부를 확인할 수 없는 공고.
- Do not call a relative bar market share.
- Do not draw a trend line until collected_weeks is at least minimum_weeks.
- Trend lines use weekly required_count + preferred_count, not total count.
- Trend scope is always 전체 경력·전체 분야 기준 until dimensioned snapshots exist.
- Keep personal next-learning guidance in the skill map; remove it from /market.
- Keep existing URL keys category and career_type and preserve them in job links.
- Preserve 44px touch targets, keyboard focus, reduced motion, and no horizontal overflow at 390px.
- Do not stage or modify the user-owned apps/web/next-env.d.ts, root package-lock.json, .agents/, docs/fixUI/, or docs/handoff/ files.

---

### Task 1: Define explicit-demand market semantics

**Files:**
- Modify: apps/web/src/features/market/model.ts:12-238
- Modify: apps/web/src/features/market/model.test.ts:1-230

**Interfaces:**
- Consumes: SkillStatsResponse.items with count, required_count, preferred_count, and unspecified_count.
- Produces: MarketSort including explicit, MarketSkill.explicitCount, MarketSkill.relativeExplicitDemand, and deterministic sortMarketSkills.

- [ ] **Step 1: Write the failing explicit-demand tests**

Add a lower-total but higher-explicit fixture and these assertions:

~~~typescript
const explicitLeader: SkillStatsResponse = {
  total: 3,
  items: [
    {
      skill: "Python",
      category: "language",
      count: 20,
      required_count: 3,
      preferred_count: 2,
      unspecified_count: 15,
    },
    {
      skill: "AWS",
      category: "infra",
      count: 15,
      required_count: 7,
      preferred_count: 3,
      unspecified_count: 5,
    },
    {
      skill: "Go",
      category: "language",
      count: 10,
      required_count: 0,
      preferred_count: 0,
      unspecified_count: 10,
    },
  ],
};

it("derives and sorts explicit demand independently from total appearances", () => {
  const snapshot = buildMarketOverviewSnapshot({
    careerType: "",
    postings: { status: "ready", data: postings },
    skillStats: { status: "ready", data: explicitLeader },
  });

  expect(snapshot.skills).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        name: "AWS",
        explicitCount: 10,
        relativeExplicitDemand: 100,
      }),
      expect.objectContaining({
        name: "Python",
        explicitCount: 5,
        relativeExplicitDemand: 50,
      }),
      expect.objectContaining({
        name: "Go",
        explicitCount: 0,
        relativeExplicitDemand: 0,
      }),
    ]),
  );
  expect(sortMarketSkills(snapshot.skills, "explicit").map((skill) => skill.name))
    .toEqual(["AWS", "Python", "Go"]);
  expect(sortMarketSkills(snapshot.skills, "demand").map((skill) => skill.name))
    .toEqual(["Python", "AWS", "Go"]);
});
~~~

- [ ] **Step 2: Run the model test and confirm the RED state**

Run from apps/web:

~~~bash
npm test -- --run src/features/market/model.test.ts
~~~

Expected: FAIL because explicit is not assignable to MarketSort and MarketSkill lacks explicitCount and relativeExplicitDemand.

- [ ] **Step 3: Implement explicit-demand fields and sorting**

Change the public types and sorter to:

~~~typescript
export type MarketSort =
  | "explicit"
  | "demand"
  | "required"
  | "preferred"
  | "name";

export type MarketSkill = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  postingCount: number;
  explicitCount: number;
  requiredCount: number;
  preferredCount: number;
  unspecifiedCount: number;
  relativeExplicitDemand: number;
  skillHref: string;
  jobsHref: string;
};

export function sortMarketSkills(
  skills: readonly MarketSkill[],
  sort: MarketSort,
) {
  return [...skills].sort((left, right) => {
    if (sort === "name") return compareName(left, right);
    if (sort === "explicit") {
      return (
        right.explicitCount - left.explicitCount ||
        right.postingCount - left.postingCount ||
        compareName(left, right)
      );
    }
    if (sort === "required") {
      return right.requiredCount - left.requiredCount || compareName(left, right);
    }
    if (sort === "preferred") {
      return right.preferredCount - left.preferredCount || compareName(left, right);
    }
    return right.postingCount - left.postingCount || compareName(left, right);
  });
}
~~~

In buildMarketOverviewSnapshot, derive the maximum and map each row with:

~~~typescript
const maxExplicitDemand = Math.max(
  1,
  ...orderedSkills.map(
    (item) => (item.required_count ?? 0) + (item.preferred_count ?? 0),
  ),
);

skills: orderedSkills.map((item): MarketSkill => {
  const requiredCount = item.required_count ?? 0;
  const preferredCount = item.preferred_count ?? 0;
  const explicitCount = requiredCount + preferredCount;
  return {
    id: skillIdentity(item.category, item.skill),
    name: item.skill,
    category: item.category,
    categoryLabel: skillCategoryLabel(normalizeSkillCategory(item.category)),
    postingCount: item.count,
    explicitCount,
    requiredCount,
    preferredCount,
    unspecifiedCount: item.unspecified_count ?? 0,
    relativeExplicitDemand: Math.round(
      (explicitCount / maxExplicitDemand) * 100,
    ),
    skillHref: "/skill-map?skill=" + encodeURIComponent(item.skill),
    jobsHref: buildMarketJobsHref(item.skill, input.careerType, category),
  };
}),
~~~

Remove relativeDemand and maxDemand.

- [ ] **Step 4: Run the model test and confirm GREEN**

~~~bash
npm test -- --run src/features/market/model.test.ts
~~~

Expected: all model tests pass.

- [ ] **Step 5: Commit only the model slice**

~~~bash
git add apps/web/src/features/market/model.ts apps/web/src/features/market/model.test.ts
git commit -m "feat: define explicit market demand"
~~~

---

### Task 2: Add pure trend calculations and one shared trend resource

**Files:**
- Create: apps/web/src/features/market/market-trend.ts
- Create: apps/web/src/features/market/market-trend.test.ts
- Create: apps/web/src/features/market/use-market-trends.ts
- Create: apps/web/src/features/market/use-market-trends.test.tsx

**Interfaces:**
- Consumes: SkillTrendPoint, SkillTrendSeries, SkillTrendResponse, selected skill, and ordered MarketSkill values.
- Produces: explicitTrendCount(point), latestExplicitTrendDelta(series), buildTrendSkills(selected, skills), MarketTrendResource, and useMarketTrends(options).

- [ ] **Step 1: Write failing pure-function tests**

~~~typescript
import { describe, expect, it } from "vitest";
import type { SkillTrendSeries } from "@/lib/types";
import {
  buildTrendSkills,
  explicitTrendCount,
  latestExplicitTrendDelta,
} from "./market-trend";

const series: SkillTrendSeries = {
  skill: "Python",
  category: "language",
  points: [
    {
      week_start: "2026-07-06",
      count: 30,
      required_count: 8,
      preferred_count: 4,
      unspecified_count: 18,
    },
    {
      week_start: "2026-07-13",
      count: 32,
      required_count: 9,
      preferred_count: 6,
      unspecified_count: 17,
    },
  ],
};

describe("market trend", () => {
  it("uses explicit demand for chart values and weekly delta", () => {
    expect(explicitTrendCount(series.points[0])).toBe(12);
    expect(latestExplicitTrendDelta(series)).toEqual({
      current: 15,
      delta: 3,
      previous: 12,
    });
  });

  it("returns no delta until two real points exist", () => {
    expect(latestExplicitTrendDelta({ ...series, points: series.points.slice(0, 1) }))
      .toBeNull();
  });

  it("keeps the selection first and returns at most three unique skills", () => {
    expect(
      buildTrendSkills("Docker", [
        { name: "Python" },
        { name: "Docker" },
        { name: "AWS" },
        { name: "LLM" },
      ]),
    ).toEqual(["Docker", "Python", "AWS"]);
  });
});
~~~

- [ ] **Step 2: Run the pure trend test and confirm RED**

~~~bash
npm test -- --run src/features/market/market-trend.test.ts
~~~

Expected: FAIL because market-trend.ts does not exist.

- [ ] **Step 3: Implement the pure trend module**

~~~typescript
import type {
  SkillTrendPoint,
  SkillTrendResponse,
  SkillTrendSeries,
} from "@/lib/types";

export type MarketTrendResource =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: SkillTrendResponse };

export function explicitTrendCount(point: SkillTrendPoint) {
  return point.required_count + point.preferred_count;
}

export function latestExplicitTrendDelta(series: SkillTrendSeries) {
  if (series.points.length < 2) return null;
  const previous = explicitTrendCount(series.points.at(-2)!);
  const current = explicitTrendCount(series.points.at(-1)!);
  return { current, delta: current - previous, previous };
}

export function buildTrendSkills(
  selectedSkill: string,
  skills: readonly { name: string }[],
) {
  return Array.from(
    new Set(
      [selectedSkill, ...skills.map((skill) => skill.name)].filter(Boolean),
    ),
  ).slice(0, 3);
}
~~~

- [ ] **Step 4: Add hook tests, then implement one request owner**

The hook test must verify selection order, the request query, ready state, and retry:

~~~typescript
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMarketTrends } from "./use-market-trends";

describe("useMarketTrends", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("requests at most three technologies and can retry", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "collecting",
        collected_weeks: 2,
        minimum_weeks: 4,
        latest_snapshot_at: "2026-07-22T00:00:00Z",
        series: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() =>
      useMarketTrends({
        availableSkills: [
          { name: "Python" },
          { name: "AWS" },
          { name: "LLM" },
        ],
        selectedSkill: "AWS",
      }),
    );

    await waitFor(() => expect(result.current.resource.status).toBe("ready"));
    expect(result.current.comparedSkills).toEqual(["AWS", "Python", "LLM"]);
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/market/trend-data?skills=AWS&skills=Python&skills=LLM",
      expect.objectContaining({ cache: "no-store" }),
    );

    act(() => result.current.retry());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });
});
~~~

Implement:

~~~typescript
"use client";

import { useEffect, useMemo, useState } from "react";
import type { SkillTrendResponse } from "@/lib/types";
import {
  buildTrendSkills,
  type MarketTrendResource,
} from "./market-trend";

type TrendSkillOption = { name: string };

export function useMarketTrends({
  availableSkills,
  selectedSkill,
}: {
  availableSkills: readonly TrendSkillOption[];
  selectedSkill: string;
}) {
  const availableKey = availableSkills.map((skill) => skill.name).join("\u0000");
  const availableNames = useMemo(
    () => (availableKey ? availableKey.split("\u0000") : []),
    [availableKey],
  );
  const [comparedSkills, setComparedSkills] = useState(() =>
    buildTrendSkills(selectedSkill, availableSkills),
  );
  const [resource, setResource] = useState<MarketTrendResource>({ status: "idle" });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    setComparedSkills((current) =>
      buildTrendSkills(selectedSkill, [
        ...current.map((name) => ({ name })),
        ...availableNames.map((name) => ({ name })),
      ]),
    );
  }, [availableNames, selectedSkill]);

  const comparisonKey = useMemo(
    () => comparedSkills.join("\u0000"),
    [comparedSkills],
  );

  useEffect(() => {
    const requestedSkills = comparisonKey
      ? comparisonKey.split("\u0000")
      : [];
    if (requestedSkills.length === 0) {
      setResource({ status: "idle" });
      return;
    }
    const controller = new AbortController();
    const params = new URLSearchParams();
    requestedSkills.forEach((skill) => params.append("skills", skill));
    setResource({ status: "loading" });
    void fetch("/market/trend-data?" + params.toString(), {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("trend request failed");
        return response.json() as Promise<SkillTrendResponse>;
      })
      .then((data) => setResource({ status: "ready", data }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setResource({ status: "error" });
      });
    return () => controller.abort();
  }, [comparisonKey, requestVersion]);

  return {
    addSkill(skill: string) {
      setComparedSkills((current) =>
        Array.from(new Set([...current, skill])).slice(0, 3),
      );
    },
    comparedSkills,
    removeSkill(skill: string) {
      setComparedSkills((current) =>
        current.filter((candidate) => candidate !== skill),
      );
    },
    resource,
    retry() {
      setRequestVersion((current) => current + 1);
    },
  };
}
~~~

The effect dependencies use stable string-derived values. Do not add the caller's availableSkills array to either effect dependency list.

- [ ] **Step 5: Run and commit the trend resource slice**

~~~bash
npm test -- --run src/features/market/market-trend.test.ts src/features/market/use-market-trends.test.tsx
git add apps/web/src/features/market/market-trend.ts apps/web/src/features/market/market-trend.test.ts apps/web/src/features/market/use-market-trends.ts apps/web/src/features/market/use-market-trends.test.tsx
git commit -m "feat: share verified market trend data"
~~~

Expected: both files pass and the commit contains only these four files.

---

### Task 3: Replace the dense demand table with the selected bar chart

**Files:**
- Create: apps/web/src/features/market/explicit-demand-bar.tsx
- Create: apps/web/src/features/market/technology-demand-chart.tsx
- Create: apps/web/src/features/market/technology-demand-chart.test.tsx
- Modify: apps/web/src/features/market/market-overview.tsx:7-20,169-174
- Modify: apps/web/src/features/market/market-overview.module.css:325-611
- Modify: apps/web/src/features/market/market-overview.styles.test.ts:28-63
- Delete: apps/web/src/features/market/demand-stacked-bar.tsx
- Delete: apps/web/src/features/market/technology-demand-table.tsx

**Interfaces:**
- Consumes: readonly MarketSkill[], MarketSort, selectedSkill, and onSelect.
- Produces: TechnologyDemandChart with eight default rows, accessible explicit-demand bars, and an in-place expand/collapse button.

- [ ] **Step 1: Write the failing chart component test**

~~~typescript
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { MarketSkill } from "./model";
import { TechnologyDemandChart } from "./technology-demand-chart";

function skill(index: number): MarketSkill {
  return {
    id: "language:skill-" + index,
    name: "Skill " + index,
    category: "language",
    categoryLabel: "언어",
    postingCount: 20 - index,
    explicitCount: 18 - index,
    requiredCount: 10 - Math.floor(index / 2),
    preferredCount: 8 - Math.ceil(index / 2),
    unspecifiedCount: 2,
    relativeExplicitDemand: Math.round(((18 - index) / 18) * 100),
    skillHref: "/skill-map?skill=Skill%20" + index,
    jobsHref: "/jobs?q=Skill%20" + index,
  };
}

it("shows eight explicit-demand rows and expands without navigation", () => {
  const onSelect = vi.fn();
  render(
    <TechnologyDemandChart
      onSelect={onSelect}
      selectedSkill="Skill 0"
      skills={Array.from({ length: 10 }, (_, index) => skill(index))}
      sort="explicit"
    />,
  );

  const region = screen.getByRole("region", { name: "현재 기술 수요" });
  expect(region.querySelectorAll("[data-skill-row]")).toHaveLength(8);
  expect(within(region).getAllByText("구분 안 됨 2건")).toHaveLength(8);
  expect(
    within(region).getByRole("button", { name: "전체 10개 기술 보기" }),
  ).toBeInTheDocument();

  fireEvent.click(
    within(region).getByRole("button", { name: "전체 10개 기술 보기" }),
  );
  expect(region.querySelectorAll("[data-skill-row]")).toHaveLength(10);
  expect(
    within(region).getByRole("button", { name: "상위 8개만 보기" }),
  ).toBeInTheDocument();
});
~~~

- [ ] **Step 2: Run the chart test and confirm RED**

~~~bash
npm test -- --run src/features/market/technology-demand-chart.test.tsx
~~~

Expected: FAIL because TechnologyDemandChart does not exist.

- [ ] **Step 3: Implement the explicit bar**

~~~typescript
import type { MarketSkill } from "./model";
import styles from "./market-overview.module.css";

function segmentWidth(count: number, total: number) {
  return total > 0 ? String((count / total) * 100) + "%" : "0%";
}

export function ExplicitDemandBar({
  descriptionId,
  skill,
}: {
  descriptionId: string;
  skill: MarketSkill;
}) {
  return (
    <div className={styles.explicitDemand}>
      <span className={styles.srOnly} id={descriptionId}>
        {skill.categoryLabel}, 명시 요구 {skill.explicitCount}건, 필수{" "}
        {skill.requiredCount}건, 우대 {skill.preferredCount}건, 전체 등장{" "}
        {skill.postingCount}건, 구분 안 됨 {skill.unspecifiedCount}건, 현재
        1위 대비 막대 길이 {skill.relativeExplicitDemand}%
      </span>
      <span aria-hidden="true" className={styles.explicitDemandTrack}>
        <span
          className={styles.explicitDemandFill}
          style={{ width: String(skill.relativeExplicitDemand) + "%" }}
        >
          <i
            data-segment="required"
            style={{ width: segmentWidth(skill.requiredCount, skill.explicitCount) }}
          />
          <i
            data-segment="preferred"
            style={{ width: segmentWidth(skill.preferredCount, skill.explicitCount) }}
          />
        </span>
      </span>
      <span aria-hidden="true" className={styles.requirementCounts}>
        <span>필수 {skill.requiredCount.toLocaleString("ko-KR")}건</span>
        <span>우대 {skill.preferredCount.toLocaleString("ko-KR")}건</span>
        <span>구분 안 됨 {skill.unspecifiedCount.toLocaleString("ko-KR")}건</span>
      </span>
    </div>
  );
}
~~~

- [ ] **Step 4: Implement the chart, wire it into MarketOverview, and remove old components**

The new component must use sortMarketSkills, the existing FLIP hook, TechnologyIcon, and this complete state prelude and row contract:

~~~tsx
import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
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
  return "skill-demand-" + skill.id.replace(/[^a-z0-9_-]/gi, "-");
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
      <h2 id="skill-demand-title">현재 기술 수요</h2>
      <p>막대 길이는 필수·우대로 명시된 공고 수를 비교합니다.</p>
    </div>
    <div aria-label="요구 조건 범례" className={styles.legend}>
      <span data-legend="required">필수</span>
      <span data-legend="preferred">우대</span>
    </div>
  </header>
  <p className={styles.relativeNote}>
    막대 길이는 시장점유율이 아니라 현재 1위 기술 대비 길이입니다.
  </p>
  <div aria-hidden="true" className={styles.tableHeader}>
    <span>순위 · 기술</span>
    <span>명시 요구</span>
    <span>필수 · 우대 · 구분 안 됨</span>
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
          aria-label={skill.name + " 기술 선택"}
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
          <span className={styles.explicitCount}>
            <strong>{skill.explicitCount.toLocaleString("ko-KR")}건</strong>
            <small>전체 등장 {skill.postingCount.toLocaleString("ko-KR")}건</small>
          </span>
          <ExplicitDemandBar descriptionId={descriptionId(skill)} skill={skill} />
        </button>
        <Link
          aria-label={skill.name + " 관련 공고 보기"}
          className={styles.rowAction}
          href={skill.jobsHref}
        >
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </li>
    ))}
  </ol>
  {skills.length > DEFAULT_VISIBLE_ROWS ? (
    <button className={styles.showMore} onClick={() => setExpanded(!expanded)} type="button">
      {expanded
        ? "상위 8개만 보기"
        : "전체 " + skills.length.toLocaleString("ko-KR") + "개 기술 보기"}
    </button>
  ) : null}
</section>
  );
}
~~~

Update MarketOverview to import and render TechnologyDemandChart. Delete the two superseded files only after no import references remain.

Add exact CSS behavior:

~~~css
.tableHeader {
  grid-template-columns: minmax(12rem, 1.05fr) minmax(6rem, 0.45fr)
    minmax(15rem, 1.25fr) var(--touch-target);
}

.skillSelect {
  grid-template-columns: minmax(12rem, 1.05fr) minmax(6rem, 0.45fr)
    minmax(15rem, 1.25fr);
}

.explicitDemandTrack {
  display: block;
  height: 0.75rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-surface-muted);
}

.explicitCount {
  display: grid;
  justify-items: end;
  gap: 0.125rem;
  font-variant-numeric: tabular-nums;
}

.explicitCount small {
  color: var(--color-muted);
  font-size: 0.75rem;
}

.showMore {
  width: 100%;
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  background: var(--color-surface);
  cursor: pointer;
}

.explicitDemandFill {
  display: flex;
  height: 100%;
  overflow: hidden;
  border-radius: inherit;
  transition: width 320ms ease;
}

.explicitDemandFill > [data-segment="required"] {
  background: var(--market-required);
}

.explicitDemandFill > [data-segment="preferred"] {
  background: var(--market-preferred);
}
~~~

Remove .relativeDemand rules and the unspecified legend/segment color assertion. Keep the unspecified token available for the separate text label.

- [ ] **Step 5: Run chart, overview, and style tests; commit**

~~~bash
npm test -- --run src/features/market/technology-demand-chart.test.tsx src/features/market/market-overview.test.tsx src/features/market/market-overview.styles.test.ts
git add apps/web/src/features/market/explicit-demand-bar.tsx apps/web/src/features/market/technology-demand-chart.tsx apps/web/src/features/market/technology-demand-chart.test.tsx apps/web/src/features/market/market-overview.tsx apps/web/src/features/market/market-overview.module.css apps/web/src/features/market/market-overview.styles.test.ts apps/web/src/features/market/demand-stacked-bar.tsx apps/web/src/features/market/technology-demand-table.tsx
git commit -m "feat: visualize explicit technology demand"
~~~

Expected: focused tests pass; git records the two old files as deleted.

---

### Task 4: Share trend state with the market pulse and trend chart

**Files:**
- Create: apps/web/src/features/market/market-pulse-summary.tsx
- Create: apps/web/src/features/market/market-pulse-summary.test.tsx
- Modify: apps/web/src/features/market/technology-trend-panel.tsx:1-322
- Modify: apps/web/src/features/market/market-overview.tsx:1-216
- Modify: apps/web/src/features/market/market-overview.test.tsx:115-260

**Interfaces:**
- Consumes: MarketOverviewSnapshot, top three explicit-demand skills, MarketTrendResource, shared comparison controls.
- Produces: MarketPulseSummary and a presentation-only TechnologyTrendPanel using explicit weekly counts and honest scope text.

- [ ] **Step 1: Write failing pulse and trend-state tests**

The pulse test:

~~~typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarketPulseSummary } from "./market-pulse-summary";

it("summarizes the leader, top three, and collecting progress", () => {
  render(
    <MarketPulseSummary
      postingCountLabel="1,771건 확인"
      topSkills={[
        { explicitCount: 330, name: "Python" },
        { explicitCount: 235, name: "AWS" },
        { explicitCount: 226, name: "LLM" },
      ]}
      trendResource={{
        status: "ready",
        data: {
          status: "collecting",
          collected_weeks: 2,
          minimum_weeks: 4,
          latest_snapshot_at: null,
          series: [],
        },
      }}
      verifiedLabel="2026. 7. 22."
    />,
  );
  expect(screen.getByText("Python · 330건")).toBeInTheDocument();
  expect(screen.getByText("Python · AWS · LLM")).toBeInTheDocument();
  expect(screen.getByText("2/4주 수집 중")).toBeInTheDocument();
});
~~~

Extend MarketOverview tests with a fetch mock returning both collecting and ready payloads. The ready payload must contain two points where Python explicit demand is 12 then 15. Assert:

~~~typescript
expect(await screen.findByText("전주 대비 +3건")).toBeInTheDocument();
expect(screen.getByText("전체 경력·전체 분야 기준")).toBeInTheDocument();
expect(screen.getByRole("img", { name: /주차 명시 요구 변화/ })).toBeInTheDocument();
~~~

- [ ] **Step 2: Run focused tests and confirm RED**

~~~bash
npm test -- --run src/features/market/market-pulse-summary.test.tsx src/features/market/market-overview.test.tsx
~~~

Expected: pulse component missing and current chart still uses point.count.

- [ ] **Step 3: Implement MarketPulseSummary**

~~~tsx
import type { MarketTrendResource } from "./market-trend";
import styles from "./market-overview.module.css";

type PulseSkill = { explicitCount: number; name: string };

function trendLabel(resource: MarketTrendResource) {
  if (resource.status === "loading" || resource.status === "idle") {
    return "추세 상태 확인 중";
  }
  if (resource.status === "error") return "추세 확인 불가";
  if (resource.data.status === "collecting") {
    return (
      String(resource.data.collected_weeks) +
      "/" +
      String(resource.data.minimum_weeks) +
      "주 수집 중"
    );
  }
  return "주간 추세 확인 가능";
}

export function MarketPulseSummary({
  postingCountLabel,
  topSkills,
  trendResource,
  verifiedLabel,
}: {
  postingCountLabel: string;
  topSkills: readonly PulseSkill[];
  trendResource: MarketTrendResource;
  verifiedLabel: string;
}) {
  const leader = topSkills[0];
  return (
    <section aria-label="현재 채용시장 요약" className={styles.pulsePanel}>
      <div className={styles.pulsePrimary}>
        <span>가장 많이 명시된 기술</span>
        <strong>
          {leader
            ? leader.name + " · " + leader.explicitCount.toLocaleString("ko-KR") + "건"
            : "확인 불가"}
        </strong>
        <small>필수·우대로 명시된 공식 공고</small>
      </div>
      <div>
        <span>명시 요구 상위</span>
        <strong>{topSkills.map((skill) => skill.name).join(" · ") || "확인 불가"}</strong>
        <small>{postingCountLabel}</small>
      </div>
      <div>
        <span>최근 변화</span>
        <strong>{trendLabel(trendResource)}</strong>
        <small>{verifiedLabel} 기준</small>
      </div>
    </section>
  );
}
~~~

- [ ] **Step 4: Convert TechnologyTrendPanel to shared presentation state**

Remove its fetch effects and internal resource. Add props:

~~~typescript
export function TechnologyTrendPanel({
  availableSkills,
  comparedSkills,
  filterIsActive,
  onAddSkill,
  onRemoveSkill,
  onRetry,
  resource,
}: {
  availableSkills: TrendSkillOption[];
  comparedSkills: string[];
  filterIsActive: boolean;
  onAddSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
  onRetry: () => void;
  resource: MarketTrendResource;
})
~~~

Use explicitTrendCount(point) everywhere the current component uses point.count:

~~~typescript
const maximum = Math.max(
  ...series.flatMap((item) => item.points.map(explicitTrendCount)),
  1,
);

const path = item.points
  .map((point, index) => {
    const command = index === 0 ? "M" : "L";
    return (
      command +
      x(index).toFixed(1) +
      "," +
      y(explicitTrendCount(point)).toFixed(1)
    );
  })
  .join(" ");
~~~

Each latest value must show the count and delta:

~~~tsx
const delta = latestExplicitTrendDelta(item);
<li key={item.skill}>
  <span>{item.skill}</span>
  <strong>{delta ? delta.current.toLocaleString("ko-KR") + "건" : "확인 중"}</strong>
  <small>
    {delta
      ? delta.delta === 0
        ? "변화 없음"
        : "전주 대비 " + (delta.delta > 0 ? "+" : "") + delta.delta + "건"
      : "전주 비교 대기"}
  </small>
</li>
~~~

Change the chart aria-label and hidden-table caption to 명시 요구. Add the persistent scope line:

~~~tsx
<span>최근 12주 · 주간 공개 공고 스냅샷</span>
<p className={styles.trendScope}>
  전체 경력·전체 분야 기준
  {filterIsActive ? " · 위 필터와 별도" : ""}
</p>
~~~

The error state must contain:

~~~tsx
<button onClick={onRetry} type="button">다시 시도</button>
~~~

In MarketOverview:

~~~typescript
const orderedSkills = useMemo(
  () => sortMarketSkills(snapshot.skills, sort),
  [snapshot.skills, sort],
);
const topExplicitSkills = useMemo(
  () => sortMarketSkills(snapshot.skills, "explicit").slice(0, 3),
  [snapshot.skills],
);
const trendSkills = useMemo(
  () => orderedSkills.slice(0, 15).map(({ category, name }) => ({ category, name })),
  [orderedSkills],
);
const trend = useMarketTrends({
  availableSkills: trendSkills,
  selectedSkill: effectiveSkill,
});
~~~

Render MarketPulseSummary before MarketFilters and pass trend.resource to both pulse and TechnologyTrendPanel. Initialize sort with explicit and initialize selectedSkill from topExplicitSkills[0].

- [ ] **Step 5: Run focused tests and commit**

~~~bash
npm test -- --run src/features/market/market-pulse-summary.test.tsx src/features/market/market-trend.test.ts src/features/market/use-market-trends.test.tsx src/features/market/market-overview.test.tsx
git add apps/web/src/features/market/market-pulse-summary.tsx apps/web/src/features/market/market-pulse-summary.test.tsx apps/web/src/features/market/technology-trend-panel.tsx apps/web/src/features/market/market-overview.tsx apps/web/src/features/market/market-overview.test.tsx
git commit -m "feat: add honest market pulse and weekly trends"
~~~

Expected: one network request supplies both the pulse status and trend panel.

---

### Task 5: Consolidate selected-skill evidence and remove duplicated personalization

**Files:**
- Create: apps/web/src/features/market/selected-technology-evidence.tsx
- Create: apps/web/src/features/market/selected-technology-evidence.test.tsx
- Modify: apps/web/src/features/market/market-overview.tsx:1-216
- Modify: apps/web/src/features/market/market-overview.test.tsx:188-292
- Modify: apps/web/src/features/market/market-filters.tsx:17-140
- Delete: apps/web/src/features/market/recent-job-list.tsx
- Delete: apps/web/src/features/market/skill-combination-recommendations.tsx
- Delete: apps/web/src/features/market/market-fit-insight.tsx
- Delete: apps/web/src/features/market/use-market-fit.ts

**Interfaces:**
- Consumes: selected MarketSkill, up to five MarketJob values, up to three MarketSkillCombination values, posting error, and job browse URL.
- Produces: SelectedTechnologyEvidence with aggregate counts, sample-bound co-occurrence/jobs, full jobs link, and skill-map link.

- [ ] **Step 1: Write the failing evidence and role-boundary tests**

~~~typescript
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SelectedTechnologyEvidence } from "./selected-technology-evidence";

it("separates full-market counts from the loaded evidence sample", () => {
  render(
    <SelectedTechnologyEvidence
      combinations={[
        {
          id: "Docker::Kubernetes",
          skills: ["Docker", "Kubernetes"],
          postingCount: 2,
        },
      ]}
      error={null}
      jobs={[]}
      selected={{
        id: "infra:kubernetes",
        name: "Kubernetes",
        category: "infra",
        categoryLabel: "인프라",
        postingCount: 12,
        explicitCount: 9,
        requiredCount: 5,
        preferredCount: 4,
        unspecifiedCount: 3,
        relativeExplicitDemand: 100,
        skillHref: "/skill-map?skill=Kubernetes",
        jobsHref: "/jobs?q=Kubernetes",
      }}
    />,
  );

  expect(screen.getByText("명시 요구").closest("div"))
    .toHaveTextContent("명시 요구9건");
  expect(screen.getByText("구분 안 됨").closest("div"))
    .toHaveTextContent("구분 안 됨3건");
  expect(screen.getByText(/현재 불러온 최대 100개 공식 공고 기준/))
    .toBeInTheDocument();
  expect(screen.getByRole("link", { name: "관련 공고 전체 보기" }))
    .toHaveAttribute("href", "/jobs?q=Kubernetes");
  expect(screen.getByRole("link", { name: "내 스킬맵에서 보기" }))
    .toHaveAttribute("href", "/skill-map?skill=Kubernetes");
});
~~~

Add integration assertions:

~~~typescript
expect(screen.queryByText(/내 기술을 저장하면/)).not.toBeInTheDocument();
expect(screen.queryByText(/다음 학습 후보/)).not.toBeInTheDocument();
expect(screen.getByRole("region", { name: "Kubernetes 시장 근거" }))
  .toBeInTheDocument();
expect(screen.getByRole("navigation", { name: "포함 기술 분야" }))
  .toBeInTheDocument();
expect(screen.getByText(/선택한 분야의 기술이 하나 이상 확인된 공고/))
  .toBeInTheDocument();
~~~

- [ ] **Step 2: Run evidence and overview tests and confirm RED**

~~~bash
npm test -- --run src/features/market/selected-technology-evidence.test.tsx src/features/market/market-overview.test.tsx
~~~

Expected: evidence component missing and personal-fit copy still rendered.

- [ ] **Step 3: Implement SelectedTechnologyEvidence**

The component must render one section with aria-label equal to selected.name + 시장 근거. Its aggregate metric block is:

~~~tsx
import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { CompanyMark } from "@/features/home-feed/company-mark";
import type {
  MarketJob,
  MarketSkill,
  MarketSkillCombination,
} from "./model";
import styles from "./market-overview.module.css";

export function SelectedTechnologyEvidence({
  combinations,
  error,
  jobs,
  selected,
}: {
  combinations: readonly MarketSkillCombination[];
  error: string | null;
  jobs: readonly MarketJob[];
  selected: MarketSkill | undefined;
}) {
  if (!selected) return null;

  return (
    <section
      aria-label={selected.name + " 시장 근거"}
      className={styles.evidencePanel}
      role="region"
    >
      <header className={styles.sideHeader}>
        <div>
          <h2>{selected.name}</h2>
          <span>선택 기술의 시장 근거</span>
        </div>
      </header>
<dl className={styles.evidenceMetrics}>
  <div><dt>명시 요구</dt><dd>{selected.explicitCount.toLocaleString("ko-KR")}건</dd></div>
  <div><dt>필수</dt><dd>{selected.requiredCount.toLocaleString("ko-KR")}건</dd></div>
  <div><dt>우대</dt><dd>{selected.preferredCount.toLocaleString("ko-KR")}건</dd></div>
  <div><dt>구분 안 됨</dt><dd>{selected.unspecifiedCount.toLocaleString("ko-KR")}건</dd></div>
</dl>
~~~

Under the aggregate block, show direct co-occurrence:

~~~tsx
{error ? (
  <div className={styles.compactState} role="alert">
    <strong>{error}</strong>
    <p>전체 시장 수요 수치는 계속 확인할 수 있습니다.</p>
  </div>
) : (
  <>
<div className={styles.evidenceSection}>
  <h3>함께 확인된 기술</h3>
  {combinations.length > 0 ? (
    <ul className={styles.connectionList}>
      {combinations.map((combination) => {
        const other = combination.skills.find(
          (skill) => skill.toLocaleLowerCase("en-US") !==
            selected.name.toLocaleLowerCase("en-US"),
        );
        return (
          <li key={combination.id}>
            <span>{other ?? combination.skills.join(" + ")}</span>
            <b>함께 {combination.postingCount}건</b>
          </li>
        );
      })}
    </ul>
  ) : (
    <p>현재 불러온 범위에서 반복 관계를 확인하지 못했습니다.</p>
  )}
</div>
~~~

Move the CompanyMark job rows into the same component and end with exactly two actions:

~~~tsx
<div className={styles.evidenceSection}>
  <h3>관련 공식 공고</h3>
  {jobs.length > 0 ? (
    <ul className={styles.recentJobList}>
      {jobs.map((job) => (
        <li key={job.id}>
          <Link aria-label={job.companyName + " " + job.title} href={job.href}>
            <CompanyMark
              companyName={job.companyName}
              size={34}
              sourceUrl={job.sourceUrl}
            />
            <span className={styles.recentJobCopy}>
              <small>{job.companyName}</small>
              <strong>{job.title}</strong>
              <span>{job.careerLabel + " · " + job.location}</span>
            </span>
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        </li>
      ))}
    </ul>
  ) : (
    <p>현재 불러온 범위에 관련 공고가 없습니다.</p>
  )}
</div>
  </>
)}
<div className={styles.evidenceActions}>
  <Link href={selected.jobsHref}>관련 공고 전체 보기</Link>
  <Link href={selected.skillHref}>내 스킬맵에서 보기</Link>
</div>
<p className={styles.panelFootnote}>
  함께 확인된 기술과 공고 예시는 현재 불러온 최대 100개 공식 공고 기준입니다.
</p>
    </section>
  );
}
~~~

When error is non-null, keep the aggregate metrics and replace both sample-derived sections with the role=alert message shown above.

- [ ] **Step 4: Reassemble MarketOverview and update filter language**

Remove MarketFitInsight/useMarketFit and the standalone combination/recent-job panels. Derive recentJobs and combinations as before, then render:

~~~tsx
<div className={styles.dashboardGrid}>
  <div className={styles.mainColumn}>
    <TechnologyDemandChart
      onSelect={setSelectedSkill}
      selectedSkill={effectiveSkill}
      skills={snapshot.skills}
      sort={sort}
    />
  </div>
  <aside className={styles.sideColumn}>
    <TechnologyTrendPanel
      availableSkills={trendSkills}
      comparedSkills={trend.comparedSkills}
      filterIsActive={Boolean(snapshot.careerType || snapshot.category)}
      onAddSkill={trend.addSkill}
      onRemoveSkill={trend.removeSkill}
      onRetry={trend.retry}
      resource={trend.resource}
    />
    <SelectedTechnologyEvidence
      combinations={combinations}
      error={snapshot.postingError}
      jobs={recentJobs}
      selected={selected}
    />
  </aside>
</div>
~~~

In MarketFilters:

~~~typescript
const SORT_OPTIONS: Array<{ value: MarketSort; label: string }> = [
  { value: "explicit", label: "명시 요구 많은 순" },
  { value: "demand", label: "전체 등장 많은 순" },
  { value: "required", label: "필수 요구 많은 순" },
  { value: "preferred", label: "우대 요구 많은 순" },
  { value: "name", label: "기술명 순" },
];
~~~

Change both the visible label and nav aria-label to 포함 기술 분야. Add:

~~~tsx
<p className={styles.filterHelp}>
  선택한 분야의 기술이 하나 이상 확인된 공고를 모아, 그 공고에 함께 등장한
  모든 기술을 집계합니다.
</p>
~~~

Update the page title to 지금 채용시장의 기술 흐름. Replace the method note with:

~~~tsx
<p>
  막대와 주간 변화는 필수·우대로 명시된 공고 수를 사용합니다. 구분 안 됨은
  기술은 확인됐지만 원문에서 필수·우대 여부를 확인할 수 없는 공고입니다.
  막대 길이는 현재 1위 대비 비교이며 시장점유율이 아닙니다.
</p>
~~~

Delete the four unused components only after rg confirms no imports remain.

- [ ] **Step 5: Run focused tests, confirm no dead imports, and commit**

~~~bash
npm test -- --run src/features/market/selected-technology-evidence.test.tsx src/features/market/market-overview.test.tsx src/features/market/model.test.ts
rg -n "MarketFitInsight|useMarketFit|RecentJobList|SkillCombinationRecommendations" apps/web/src
git add apps/web/src/features/market/selected-technology-evidence.tsx apps/web/src/features/market/selected-technology-evidence.test.tsx apps/web/src/features/market/market-overview.tsx apps/web/src/features/market/market-overview.test.tsx apps/web/src/features/market/market-filters.tsx apps/web/src/features/market/recent-job-list.tsx apps/web/src/features/market/skill-combination-recommendations.tsx apps/web/src/features/market/market-fit-insight.tsx apps/web/src/features/market/use-market-fit.ts
git commit -m "feat: separate market evidence from learning guidance"
~~~

Expected: tests pass and rg returns no matches.

---

### Task 6: Finish responsive hierarchy, accessibility, and browser verification

**Files:**
- Modify: apps/web/src/features/market/market-overview.module.css:13-1525
- Modify: apps/web/src/features/market/market-overview.styles.test.ts:1-94
- Modify: apps/web/e2e/market-overview.e2e.ts:1-170

**Interfaces:**
- Consumes: the assembled pulse, demand chart, trend panel, and evidence panel.
- Produces: 1440×900 scan-first hierarchy, 390×844 single-column layout, color-independent labels, no overflow, and automated five-second information checks.

- [ ] **Step 1: Write failing style-contract tests**

Replace obsolete relative-demand assertions with:

~~~typescript
it("makes the explicit-demand chart the dominant visual", () => {
  expect(rule(".dashboardGrid")).toContain(
    "grid-template-columns: minmax(0, 1fr) 22rem;",
  );
  expect(rule(".explicitDemandFill")).toContain("transition: width 320ms ease;");
  expect(rule('.explicitDemandFill > [data-segment="required"]')).toContain(
    "background: var(--market-required);",
  );
  expect(rule('.explicitDemandFill > [data-segment="preferred"]')).toContain(
    "background: var(--market-preferred);",
  );
  expect(css).not.toContain(".relativeDemand");
});

it("stacks pulse, chart, trend, and evidence without mobile overflow", () => {
  expect(css).toMatch(
    /@media \(max-width: 52\.4375rem\)[\s\S]*?\.pulsePanel\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
  expect(css).toMatch(
    /@media \(max-width: 52\.4375rem\)[\s\S]*?\.skillSelect\s*\{[\s\S]*?grid-template-columns: minmax\(0, 1fr\);/,
  );
});
~~~

- [ ] **Step 2: Apply the final visual hierarchy**

Use these exact structural rules, then remove obsolete combinationPanel and fitPanel blocks:

~~~css
.pulsePanel {
  display: grid;
  grid-template-columns: 1.35fr 1fr 1fr;
  margin-top: 1rem;
  border: 1px solid var(--color-line);
  background: var(--color-surface);
}

.pulsePanel > div {
  min-width: 0;
  padding: 1rem 1.125rem;
  border-left: 1px solid var(--color-line);
}

.pulsePanel > div:first-child {
  border-left: 0;
}

.pulsePrimary {
  background: color-mix(in srgb, var(--color-accent) 9%, var(--color-surface));
}

.pulsePanel span,
.pulsePanel small {
  display: block;
  color: var(--color-muted);
  font-size: 0.75rem;
}

.pulsePanel strong {
  display: block;
  margin: 0.35rem 0 0.2rem;
  font-size: 1rem;
  line-height: 1.3;
}

.evidenceMetrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--color-line);
  border-bottom: 1px solid var(--color-line);
}

.evidenceMetrics > div {
  padding: 0.75rem;
  border-right: 1px solid var(--color-line);
  border-bottom: 1px solid var(--color-line);
}

.evidenceActions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
}

@media (max-width: 52.4375rem) {
  .pulsePanel {
    grid-template-columns: minmax(0, 1fr);
  }

  .pulsePanel > div {
    border-top: 1px solid var(--color-line);
    border-left: 0;
  }

  .pulsePanel > div:first-child {
    border-top: 0;
  }

  .skillSelect {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.625rem;
  }

  .tableHeader {
    display: none;
  }

  .explicitDemand,
  .explicitCount {
    width: 100%;
  }
}
~~~

Add focus-visible coverage for the expand button, trend retry, comparison removal, job links, and both evidence actions. Extend the reduced-motion block so .explicitDemandFill has transition: none.

- [ ] **Step 3: Rewrite the market E2E assertions around user questions**

For widths 1440 and 390 assert:

~~~typescript
await expect(
  page.getByRole("heading", {
    level: 1,
    name: "지금 채용시장의 기술 흐름",
  }),
).toBeVisible();
await expect(page.getByRole("region", { name: "현재 채용시장 요약" }))
  .toContainText("가장 많이 명시된 기술");
await expect(page.getByRole("region", { name: "현재 기술 수요" }))
  .toBeVisible();
await expect(page.getByText(/시장점유율이 아니라 현재 1위 기술 대비/))
  .toBeVisible();
await expect(page.getByText(/기술은 확인됐지만 원문에서 필수·우대 여부/))
  .toBeVisible();
await expect(page.getByText("전체 경력·전체 분야 기준")).toBeVisible();
await expect(page.getByText(/내 기술을 저장하면|다음 학습 후보/))
  .toHaveCount(0);
expect(
  await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  ),
).toBe(false);
~~~

At 1440×900, use bounding boxes to enforce the five-second hierarchy:

~~~typescript
const pulseBox = await page
  .getByRole("region", { name: "현재 채용시장 요약" })
  .boundingBox();
const demandBox = await page
  .getByRole("region", { name: "현재 기술 수요" })
  .boundingBox();
expect(pulseBox?.y).toBeLessThan(900);
expect(demandBox?.y).toBeLessThan(900);
expect(demandBox?.height).toBeGreaterThan(300);
~~~

Update filter selectors from 기술 분야 to 포함 기술 분야. Keep the existing no-reload, query-preservation, job-link, career-filter, console-error, and touch-target assertions. Delete the fit-analysis E2E case.

- [ ] **Step 4: Run focused verification and fix only observed contract failures**

~~~bash
npm test -- --run src/features/market src/app/market
npm run lint
npm run test:e2e -- e2e/market-overview.e2e.ts
~~~

Expected: all focused tests pass, TypeScript exits 0, and market E2E passes at all configured widths with no browser errors.

- [ ] **Step 5: Run full verification, inspect screenshots, and commit**

~~~bash
npm test -- --run
npm run lint
npm run build
npm run test:e2e
git diff --check
~~~

Capture or inspect /market at 1440×900 and 390×844. Confirm the header, data scope, leader, trend readiness, and first demand bars are legible; no fabricated line appears in collecting state; and the demand chart precedes trend/evidence on mobile.

Stage only the files changed in this task:

~~~bash
git add apps/web/src/features/market/market-overview.module.css apps/web/src/features/market/market-overview.styles.test.ts apps/web/e2e/market-overview.e2e.ts
git commit -m "feat: make the market dashboard scan-first"
~~~

Expected: final commit succeeds, unrelated user files remain unstaged, and git status reports only the pre-existing user changes.
