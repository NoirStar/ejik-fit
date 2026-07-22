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
    expect(
      latestExplicitTrendDelta({
        ...series,
        points: series.points.slice(0, 1),
      }),
    ).toBeNull();
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
