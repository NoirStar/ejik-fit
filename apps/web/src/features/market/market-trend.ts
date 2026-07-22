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
