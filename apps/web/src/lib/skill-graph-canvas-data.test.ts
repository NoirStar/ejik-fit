import { describe, expect, it } from "vitest";

import {
  skillGraphTopologySignature,
  skillGraphVisualSignature,
} from "./skill-graph-canvas-data";
import type { SkillGraphViewData } from "./skill-graph-view";

const view: SkillGraphViewData = {
  nodes: [
    {
      id: "Python",
      label: "Python",
      kind: "skill",
      category: "language",
      domain: "backend",
      domains: ["backend"],
      color: "#3d73d9",
      val: 7,
      demandCount: 12,
      owned: false,
      recommended: false,
      recommendationRank: null,
      seed: true,
    },
  ],
  links: [],
  domains: [],
  stats: { skillCount: 1, evidenceCount: 0, linkCount: 0 },
};

describe("skill graph canvas data", () => {
  it("keeps layout stable when only ownership or recommendation paint changes", () => {
    const painted: SkillGraphViewData = {
      ...view,
      nodes: view.nodes.map((node) => ({
        ...node,
        owned: true,
        recommended: true,
        recommendationRank: 1,
      })),
    };

    expect(skillGraphTopologySignature(painted)).toBe(
      skillGraphTopologySignature(view),
    );
    expect(skillGraphVisualSignature(painted)).not.toBe(
      skillGraphVisualSignature(view),
    );
  });

  it("changes the layout signature when node demand or links change", () => {
    const resized: SkillGraphViewData = {
      ...view,
      nodes: view.nodes.map((node) => ({ ...node, val: 9, demandCount: 20 })),
    };
    const linked: SkillGraphViewData = {
      ...view,
      links: [
        {
          id: "Python:SQL",
          source: "Python",
          target: "SQL",
          kind: "skill",
          cooccurrenceCount: 4,
          score: 0.7,
          value: 0.8,
        },
      ],
    };

    expect(skillGraphTopologySignature(resized)).not.toBe(
      skillGraphTopologySignature(view),
    );
    expect(skillGraphTopologySignature(linked)).not.toBe(
      skillGraphTopologySignature(view),
    );
  });
});
