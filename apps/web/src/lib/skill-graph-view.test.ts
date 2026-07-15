import { describe, expect, it } from "vitest";

import { buildSkillGraphView } from "./skill-graph-view";
import type { SkillGraphResponse } from "./types";


const graph: SkillGraphResponse = {
  seed: "C++",
  nodes: [
    {
      id: "C++",
      label: "C++",
      category: "language",
      kind: "language",
      domains: ["embedded", "game"],
      demand_count: 18,
      required_count: 12,
      preferred_count: 4,
      unspecified_count: 2,
      owned: true,
      seed: true,
    },
    {
      id: "ROS2",
      label: "ROS2",
      category: "robotics",
      kind: "framework",
      domains: ["robotics"],
      demand_count: 9,
      required_count: 7,
      preferred_count: 2,
      unspecified_count: 0,
      owned: false,
      seed: false,
    },
    {
      id: "CAN",
      label: "CAN",
      category: "protocol",
      kind: "protocol",
      domains: ["embedded"],
      demand_count: 7,
      required_count: 4,
      preferred_count: 2,
      unspecified_count: 1,
      owned: false,
      seed: false,
    },
    {
      id: "RTOS",
      label: "RTOS",
      category: "os",
      kind: "platform",
      domains: ["embedded"],
      demand_count: 6,
      required_count: 3,
      preferred_count: 2,
      unspecified_count: 1,
      owned: false,
      seed: false,
    },
    {
      id: "Kubernetes",
      label: "Kubernetes",
      category: "platform",
      kind: "platform",
      domains: ["devops"],
      demand_count: 3,
      required_count: 0,
      preferred_count: 2,
      unspecified_count: 1,
      owned: false,
      seed: false,
    },
  ],
  edges: [
    {
      id: "C++:ROS2",
      source: "C++",
      target: "ROS2",
      score: 0.84,
      cooccurrence_count: 7,
      required_pair_count: 5,
      supporting_posting_ids: ["job-1"],
    },
    {
      id: "ROS2:CAN",
      source: "ROS2",
      target: "CAN",
      score: 0.58,
      cooccurrence_count: 4,
      required_pair_count: 2,
      supporting_posting_ids: ["job-1"],
    },
    {
      id: "CAN:RTOS",
      source: "CAN",
      target: "RTOS",
      score: 0.46,
      cooccurrence_count: 3,
      required_pair_count: 2,
      supporting_posting_ids: ["job-2"],
    },
  ],
  evidence: [
    {
      posting_id: "job-1",
      title: "자율주행 SW 엔지니어",
      company_name: "네이버랩스",
      skills: ["C++", "ROS2", "CAN"],
      required: ["C++", "ROS2"],
      preferred: ["CAN"],
      unspecified: [],
    },
    {
      posting_id: "job-2",
      title: "임베디드 플랫폼 개발자",
      company_name: "현대오토에버",
      skills: ["CAN", "RTOS"],
      required: ["CAN"],
      preferred: ["RTOS"],
      unspecified: [],
    },
  ],
  meta: {
    limit: 30,
    min_confidence: 0.8,
  },
};


describe("buildSkillGraphView", () => {
  it("adds posting evidence nodes and evidence links when enabled", () => {
    const view = buildSkillGraphView(graph, {
      showEvidence: true,
      showIsolated: true,
      mode: "global",
    });

    expect(view.nodes.map((node) => node.id)).toContain("posting:job-1");
    expect(view.nodes.map((node) => node.id)).toContain("posting:job-2");
    expect(view.links).toContainEqual(
      expect.objectContaining({
        id: "posting:job-1:C++",
        source: "posting:job-1",
        target: "C++",
        kind: "evidence",
      }),
    );
    expect(view.stats.evidenceCount).toBe(2);
  });

  it("hides posting nodes and keeps only skill links when evidence is disabled", () => {
    const view = buildSkillGraphView(graph, {
      showEvidence: false,
      showIsolated: true,
      mode: "global",
    });

    expect(view.nodes.some((node) => node.kind === "posting")).toBe(false);
    expect(view.links.every((link) => link.kind === "skill")).toBe(true);
  });

  it("builds a local graph by breadth-first depth from the selected skill", () => {
    const depthOne = buildSkillGraphView(graph, {
      showEvidence: false,
      showIsolated: true,
      mode: "local",
      selectedId: "C++",
      localDepth: 1,
    });
    const depthTwo = buildSkillGraphView(graph, {
      showEvidence: false,
      showIsolated: true,
      mode: "local",
      selectedId: "C++",
      localDepth: 2,
    });

    expect(depthOne.nodes.map((node) => node.id).sort()).toEqual(["C++", "ROS2"]);
    expect(depthTwo.nodes.map((node) => node.id).sort()).toEqual([
      "C++",
      "CAN",
      "ROS2",
    ]);
  });

  it("filters skill nodes by enabled domain groups before links are emitted", () => {
    const view = buildSkillGraphView(graph, {
      enabledDomains: ["robotics"],
      showEvidence: false,
      showIsolated: true,
      mode: "global",
    });

    expect(view.nodes.map((node) => node.id)).toEqual(["ROS2"]);
    expect(view.links).toEqual([]);
    expect(view.domains.find((domain) => domain.domain === "robotics")).toMatchObject({
      enabled: true,
      count: 1,
    });
  });

  it("keeps matching skills and their nearby relationships visible during search", () => {
    const connectedMatch = buildSkillGraphView(graph, {
      query: "ROS2",
      showEvidence: false,
      showIsolated: false,
      mode: "local",
      selectedId: "C++",
      localDepth: 1,
    });
    const isolatedMatch = buildSkillGraphView(graph, {
      query: "Kubernetes",
      showEvidence: false,
      showIsolated: false,
      mode: "local",
      selectedId: "C++",
      localDepth: 1,
    });

    expect(connectedMatch.nodes.map((node) => node.id).sort()).toEqual([
      "C++",
      "CAN",
      "ROS2",
    ]);
    expect(connectedMatch.links.map((link) => link.id).sort()).toEqual([
      "C++:ROS2",
      "ROS2:CAN",
    ]);
    expect(isolatedMatch.nodes.map((node) => node.id)).toEqual(["Kubernetes"]);
  });

  it("does not expand a local view when no search query is active", () => {
    const view = buildSkillGraphView(graph, {
      showEvidence: false,
      showIsolated: false,
      mode: "local",
      selectedId: "C++",
      localDepth: 1,
    });

    expect(view.nodes.map((node) => node.id).sort()).toEqual(["C++", "ROS2"]);
  });
});
