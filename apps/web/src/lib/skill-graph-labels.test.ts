import { describe, expect, it } from "vitest";

import type { SkillGraphViewNode } from "./skill-graph-view";
import { selectSkillGraphLabelIds } from "./skill-graph-labels";


function node(id: string, domain: string, demandCount: number): SkillGraphViewNode {
  return {
    id,
    label: id,
    kind: "skill",
    category: "technology",
    domain,
    domains: [domain],
    color: "#000",
    val: 5,
    demandCount,
    owned: false,
    recommended: false,
    recommendationRank: null,
    seed: false,
  };
}


describe("selectSkillGraphLabelIds", () => {
  it("keeps one high-demand representative from every visible domain", () => {
    const nodes = [
      node("React", "frontend", 120),
      node("TypeScript", "frontend", 110),
      node("Java", "backend", 100),
      node("Kotlin", "backend", 90),
      node("ROS2", "robotics", 12),
    ];

    const labels = selectSkillGraphLabelIds(nodes, 3);

    expect(labels).toEqual(new Set(["React", "Java", "ROS2"]));
  });

  it("fills remaining label slots by demand without duplicates", () => {
    const nodes = [
      node("React", "frontend", 120),
      node("TypeScript", "frontend", 110),
      node("Java", "backend", 100),
      node("Kotlin", "backend", 90),
    ];

    expect(selectSkillGraphLabelIds(nodes, 3))
      .toEqual(new Set(["React", "Java", "TypeScript"]));
  });
});
