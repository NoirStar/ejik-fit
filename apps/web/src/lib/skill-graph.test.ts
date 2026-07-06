import { describe, expect, it } from "vitest";

import {
  domainColor,
  edgeSize,
  nodeSize,
  summarizeGraph,
} from "./skill-graph";
import type { SkillGraphResponse } from "./types";


const graph: SkillGraphResponse = {
  seed: "C++",
  nodes: [
    {
      id: "C++",
      label: "C++",
      category: "language",
      kind: "language",
      domains: ["robotics", "embedded"],
      demand_count: 6,
      required_count: 6,
      preferred_count: 0,
      unspecified_count: 0,
      owned: true,
      seed: true,
    },
    {
      id: "ROS",
      label: "ROS",
      category: "robotics",
      kind: "framework",
      domains: ["robotics"],
      demand_count: 3,
      required_count: 2,
      preferred_count: 1,
      unspecified_count: 0,
      owned: false,
      seed: false,
    },
  ],
  edges: [
    {
      id: "C++::ROS",
      source: "C++",
      target: "ROS",
      score: 0.8,
      cooccurrence_count: 3,
      required_pair_count: 2,
      supporting_posting_ids: ["1", "2"],
    },
  ],
  evidence: [],
  meta: { limit: 30, min_confidence: 0.8 },
};


describe("skill graph helpers", () => {
  it("uses stable colors for known domains", () => {
    expect(domainColor("robotics")).toBe("#2f80ed");
    expect(domainColor("unknown")).toBe("#7b8187");
  });

  it("scales node and edge sizes within readable bounds", () => {
    expect(nodeSize(0)).toBe(8);
    expect(nodeSize(100)).toBe(28);
    expect(edgeSize(0)).toBe(1);
    expect(edgeSize(1)).toBe(6);
  });

  it("summarizes graph for accessible fallback", () => {
    expect(summarizeGraph(graph)).toBe("C++ 중심 그래프: 2개 스킬, 1개 관계");
  });
});
