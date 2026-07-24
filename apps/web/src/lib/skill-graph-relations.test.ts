import { describe, expect, it } from "vitest";

import type { SkillGraphViewLink } from "./skill-graph-view";
import {
  buildSkillGraphAdjacency,
  buildSkillGraphHighlight,
} from "./skill-graph-relations";

const links: SkillGraphViewLink[] = [
  {
    id: "A:B",
    source: "A",
    target: "B",
    kind: "skill",
    cooccurrenceCount: 9,
    score: 0.9,
    value: 3,
  },
  {
    id: "A:C",
    source: "A",
    target: "C",
    kind: "skill",
    cooccurrenceCount: 4,
    score: 0.6,
    value: 2,
  },
  {
    id: "posting:1:A",
    source: "posting:1",
    target: "A",
    kind: "evidence",
    cooccurrenceCount: 0,
    score: 0.16,
    value: 0.35,
  },
];

describe("skill graph relations", () => {
  it("indexes direct skill and evidence relationships in one reusable shape", () => {
    const adjacency = buildSkillGraphAdjacency(links);
    const relation = adjacency.get("A");

    expect(relation?.nodeIds).toEqual(new Set(["B", "C", "posting:1"]));
    expect(relation?.linkIds).toEqual(
      new Set(["A:B", "A:C", "posting:1:A"]),
    );
    expect(relation?.cooccurrenceByNode).toEqual(
      new Map([
        ["B", 9],
        ["C", 4],
      ]),
    );
    expect(relation?.maxCooccurrenceCount).toBe(9);
    expect(relation?.neighborSkillCount).toBe(2);
  });

  it("normalizes focused neighbor emphasis with a bounded square root", () => {
    const highlight = buildSkillGraphHighlight(
      "A",
      buildSkillGraphAdjacency(links),
    );

    expect(highlight.nodeIds).toEqual(
      new Set(["A", "B", "C", "posting:1"]),
    );
    expect(highlight.linkIds).toEqual(
      new Set(["A:B", "A:C", "posting:1:A"]),
    );
    expect(highlight.relationRatios.get("B")).toBe(1);
    expect(highlight.relationRatios.get("C")).toBeCloseTo(2 / 3);
    expect(highlight.relationRatios.get("posting:1")).toBe(0);
  });

  it("returns an empty highlight for an unknown or absent focus", () => {
    const adjacency = buildSkillGraphAdjacency(links);

    for (const focusId of [null, "missing"]) {
      expect(buildSkillGraphHighlight(focusId, adjacency)).toMatchObject({
        focusId: null,
        maxCooccurrenceCount: 0,
      });
      expect(buildSkillGraphHighlight(focusId, adjacency).nodeIds.size).toBe(0);
      expect(buildSkillGraphHighlight(focusId, adjacency).linkIds.size).toBe(0);
    }
  });
});
