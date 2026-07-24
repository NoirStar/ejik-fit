import { describe, expect, it } from "vitest";

import { buildSkillGraphView } from "./skill-graph-view";
import type { SkillGraphResponse } from "./types";


function denseGraph(nodeCount = 30): SkillGraphResponse {
  const nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `skill-${index.toString().padStart(2, "0")}`,
    label: `Skill ${index}`,
    category: index % 2 === 0 ? "language" : "platform",
    kind: index % 2 === 0 ? "language" : "platform",
    domains: [index % 3 === 0 ? "backend" : "cloud"],
    demand_count: nodeCount - index,
    required_count: Math.max(0, nodeCount - index - 2),
    preferred_count: index % 4,
    unspecified_count: 0,
    owned: index < 2,
    seed: index === 0,
  }));
  const edges = nodes.flatMap((left, leftIndex) =>
    nodes.slice(leftIndex + 1).map((right, offset) => {
      const rightIndex = leftIndex + offset + 1;
      const distance = rightIndex - leftIndex;
      const score = Number(Math.max(0.05, 1 - distance / nodeCount).toFixed(4));
      return {
        id: `${left.id}::${right.id}`,
        source: left.id,
        target: right.id,
        score,
        cooccurrence_count: Math.max(1, nodeCount - distance),
        required_pair_count: Math.max(0, nodeCount - distance - 2),
        supporting_posting_ids: [`posting-${leftIndex}-${rightIndex}`],
      };
    }),
  );

  return {
    seed: nodes[0]?.id ?? null,
    nodes,
    edges,
    evidence: [
      {
        posting_id: "evidence-1",
        title: "그래프에 그리지 않을 공고",
        company_name: "검증 기업",
        skills: nodes.slice(0, 3).map(({ id }) => id),
        required: nodes.slice(0, 2).map(({ id }) => id),
        preferred: [nodes[2]?.id ?? ""],
        unspecified: [],
      },
    ],
    meta: { limit: nodeCount, min_confidence: 0.8 },
  };
}


describe("buildSkillGraphView", () => {
  it("bounds the desktop overview and never renders posting evidence", () => {
    const view = buildSkillGraphView(denseGraph(), { mode: "overview" });

    expect(view.nodes).toHaveLength(12);
    expect(view.links.length).toBeLessThanOrEqual(18);
    expect(view.nodes.every((node) => node.kind === "skill")).toBe(true);
    expect(view.links.every((link) => link.kind === "skill")).toBe(true);
    expect(view.stats).toEqual({
      skillCount: 12,
      evidenceCount: 0,
      linkCount: view.links.length,
    });
  });

  it("accepts the smaller mobile overview budget", () => {
    const view = buildSkillGraphView(denseGraph(), {
      mode: "overview",
      nodeLimit: 8,
      linkLimit: 10,
    });

    expect(view.nodes).toHaveLength(8);
    expect(view.links.length).toBeLessThanOrEqual(10);
  });

  it("puts the selected skill first and keeps only eight strongest neighbors", () => {
    const view = buildSkillGraphView(denseGraph(), {
      mode: "focus",
      selectedId: "skill-15",
    });

    expect(view.nodes[0]?.id).toBe("skill-15");
    expect(view.nodes.length).toBeLessThanOrEqual(9);
    expect(view.links.length).toBeLessThanOrEqual(12);
    expect(
      view.links.every(
        ({ source, target }) =>
          view.nodes.some(({ id }) => id === source) &&
          view.nodes.some(({ id }) => id === target),
      ),
    ).toBe(true);
  });

  it("keeps every visible selected-to-neighbor edge before contextual edges", () => {
    const graph = denseGraph(6);
    graph.edges = [
      {
        ...graph.edges[0]!,
        id: "selected-a",
        source: "skill-05",
        target: "skill-00",
        score: 0.2,
      },
      {
        ...graph.edges[0]!,
        id: "selected-b",
        source: "skill-05",
        target: "skill-01",
        score: 0.19,
      },
      {
        ...graph.edges[0]!,
        id: "selected-c",
        source: "skill-05",
        target: "skill-02",
        score: 0.18,
      },
      {
        ...graph.edges[0]!,
        id: "context-a",
        source: "skill-00",
        target: "skill-01",
        score: 0.99,
      },
      {
        ...graph.edges[0]!,
        id: "context-b",
        source: "skill-01",
        target: "skill-02",
        score: 0.98,
      },
    ];

    const view = buildSkillGraphView(graph, {
      mode: "focus",
      selectedId: "skill-05",
      nodeLimit: 4,
      linkLimit: 3,
    });

    expect(view.nodes.map(({ id }) => id)).toEqual([
      "skill-05",
      "skill-00",
      "skill-01",
      "skill-02",
    ]);
    expect(new Set(view.links.map(({ id }) => id))).toEqual(
      new Set(["selected-a", "selected-b", "selected-c"]),
    );
  });

  it("keeps the full mode readable with a sparse 30-node backbone", () => {
    const view = buildSkillGraphView(denseGraph(40), { mode: "all" });

    expect(view.nodes).toHaveLength(30);
    expect(view.links.length).toBeLessThanOrEqual(45);
  });

  it("is deterministic when API nodes and edges arrive in another order", () => {
    const graph = denseGraph();
    const reversed: SkillGraphResponse = {
      ...graph,
      nodes: [...graph.nodes].reverse(),
      edges: [...graph.edges].reverse(),
      evidence: [...graph.evidence].reverse(),
    };

    const first = buildSkillGraphView(graph, { mode: "overview" });
    const second = buildSkillGraphView(reversed, { mode: "overview" });

    expect(second.nodes.map(({ id }) => id)).toEqual(
      first.nodes.map(({ id }) => id),
    );
    expect(second.links.map(({ id }) => id)).toEqual(
      first.links.map(({ id }) => id),
    );
  });

  it("retains a maximum-spanning forest across disconnected components", () => {
    const graph = denseGraph(6);
    graph.edges = [
      { ...graph.edges[0]!, id: "a", source: "skill-00", target: "skill-01", score: 0.9 },
      { ...graph.edges[0]!, id: "b", source: "skill-01", target: "skill-02", score: 0.8 },
      { ...graph.edges[0]!, id: "c", source: "skill-03", target: "skill-04", score: 0.7 },
      { ...graph.edges[0]!, id: "d", source: "skill-04", target: "skill-05", score: 0.6 },
      { ...graph.edges[0]!, id: "cycle", source: "skill-00", target: "skill-02", score: 0.5 },
    ];

    const view = buildSkillGraphView(graph, {
      mode: "all",
      nodeLimit: 6,
      linkLimit: 4,
    });

    expect(view.links.map(({ id }) => id)).toEqual(["a", "b", "c", "d"]);
  });

  it("promotes a search match before its strongest direct neighbors", () => {
    const view = buildSkillGraphView(denseGraph(), {
      mode: "overview",
      query: "Skill 29",
    });

    expect(view.nodes[0]?.id).toBe("skill-29");
    expect(view.nodes).toHaveLength(12);
    expect(view.links.length).toBeLessThanOrEqual(18);
  });

  it("uses compressed demand size and relationship score for thin links", () => {
    const graph = denseGraph();
    graph.edges = graph.edges.map((edge, index) => ({
      ...edge,
      score: index === 0 ? 1 : 0,
      cooccurrence_count: index === 0 ? 1 : 999,
    }));

    const view = buildSkillGraphView(graph, { mode: "overview" });
    const sizes = view.nodes.map(({ val }) => val);
    const widths = view.links.map(({ value }) => value);

    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(4.5);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(9);
    expect(Math.min(...widths)).toBeGreaterThanOrEqual(0.6);
    expect(Math.max(...widths)).toBeLessThanOrEqual(1);
    expect(view.links.find(({ score }) => score === 1)?.value).toBe(1);
  });

  it("marks recommendation nodes independently from owned skills", () => {
    const view = buildSkillGraphView(denseGraph(), {
      mode: "overview",
      recommendedIds: ["skill-02", "skill-07"],
    });

    expect(view.nodes.find(({ id }) => id === "skill-02")).toMatchObject({
      owned: false,
      recommended: true,
    });
    expect(view.nodes.find(({ id }) => id === "skill-00")).toMatchObject({
      owned: true,
      recommended: false,
    });
  });

  it("applies domain filters before ranking and sparsifying", () => {
    const view = buildSkillGraphView(denseGraph(), {
      mode: "overview",
      enabledDomains: ["backend"],
    });

    expect(view.nodes.every(({ domain }) => domain === "backend")).toBe(true);
    expect(view.domains.find(({ domain }) => domain === "backend")).toMatchObject({
      enabled: true,
      count: 10,
    });
    expect(view.domains.find(({ domain }) => domain === "cloud")).toMatchObject({
      enabled: false,
      count: 20,
    });
  });
});
