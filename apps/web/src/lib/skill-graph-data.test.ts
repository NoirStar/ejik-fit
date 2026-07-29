import { describe, expect, it } from "vitest";

import { mergeSkillGraphResponses } from "./skill-graph-data";
import type { SkillGraphResponse } from "./types";


function graph(
  seed: string | null,
  nodeIds: string[],
  edgeIds: Array<[string, string, string]>,
): SkillGraphResponse {
  return {
    seed,
    nodes: nodeIds.map((id, index) => ({
      id,
      label: id,
      category: "language",
      kind: "language",
      domains: [index % 2 === 0 ? "backend" : "cloud"],
      demand_count: 20 - index,
      required_count: 12 - index,
      preferred_count: 3,
      unspecified_count: 0,
      owned: false,
      seed: id === seed,
    })),
    edges: edgeIds.map(([id, source, target], index) => ({
      id,
      source,
      target,
      score: 0.9 - index * 0.1,
      cooccurrence_count: 8 - index,
      required_pair_count: 4,
      supporting_posting_ids: [`job-${index}`],
    })),
    evidence: [],
    meta: { limit: nodeIds.length, min_confidence: 0.8 },
  };
}


describe("mergeSkillGraphResponses", () => {
  it("adds a rare neighborhood without duplicating shared nodes or edges", () => {
    const atlas = graph(null, ["C++", "Python"], [["cpp-python", "C++", "Python"]]);
    const neighborhood = graph(
      "Rust",
      ["Rust", "C++", "Linux"],
      [
        ["rust-cpp", "Rust", "C++"],
        ["cpp-python", "C++", "Python"],
      ],
    );

    const merged = mergeSkillGraphResponses(atlas, neighborhood);

    expect(merged.seed).toBeNull();
    expect(merged.nodes.map(({ id }) => id)).toEqual([
      "C++",
      "Python",
      "Rust",
      "Linux",
    ]);
    expect(merged.nodes.find(({ id }) => id === "Rust")?.seed).toBe(false);
    expect(merged.edges.map(({ id }) => id)).toEqual([
      "cpp-python",
      "rust-cpp",
    ]);
    expect(merged.meta.limit).toBe(4);
  });

  it("keeps the atlas copy immutable", () => {
    const atlas = graph(null, ["C++"], []);
    const neighborhood = graph("Rust", ["Rust"], []);

    mergeSkillGraphResponses(atlas, neighborhood);

    expect(atlas.nodes).toHaveLength(1);
    expect(neighborhood.nodes[0]?.seed).toBe(true);
  });
});
