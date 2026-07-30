import { describe, expect, it } from "vitest";

import {
  SKILL_GRAPH_DISPLAY_BUDGETS,
  SKILL_GRAPH_LAYOUT_BUDGETS,
  skillGraphTopologySignature,
  skillGraphVisualSignature,
} from "./skill-graph-canvas-data";
import type { GraphRendererProps } from "./graph-renderer";
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
    {
      id: "SQL",
      label: "SQL",
      kind: "skill",
      category: "database",
      domain: "backend",
      domains: ["backend"],
      color: "#27ae60",
      val: 5,
      demandCount: 8,
      owned: false,
      recommended: false,
      recommendationRank: null,
      seed: false,
    },
  ],
  links: [],
  domains: [],
  stats: { skillCount: 2, evidenceCount: 0, linkCount: 0 },
};

describe("skill graph canvas data", () => {
  it("keeps the full bounded layout on compact screens", () => {
    expect(SKILL_GRAPH_LAYOUT_BUDGETS).toEqual({
      compact: { links: 64, nodes: 40 },
      regular: { links: 96, nodes: 60 },
    });
    expect(SKILL_GRAPH_DISPLAY_BUDGETS).toEqual({
      compact: { links: 48, nodes: 30 },
      focus: { links: 30, nodes: 18 },
      regular: { links: 84, nodes: 48 },
    });
  });

  it("keeps topology stable when only the display masks change", () => {
    const firstMask = new Set([view.nodes[0]!.id]);
    const secondMask = new Set(view.nodes.map(({ id }) => id));
    const rendererContract: GraphRendererProps = {
      data: view,
      display: {
        animate: true,
        arrows: false,
        labelLimit: 12,
        labelThreshold: 0.18,
        linkThickness: 1,
        nodeScale: 1,
      },
      forces: {
        center: 0.04,
        cluster: 0.04,
        clusterSpread: 180,
        link: 0.16,
        linkDistance: 80,
        repel: 110,
      },
      onNodeSelect: () => undefined,
      selectedId: null,
      visibleNodeIds: firstMask,
      visibleLinkIds: new Set(),
    };

    expect(firstMask).not.toEqual(secondMask);
    expect(skillGraphTopologySignature(rendererContract.data)).toBe(
      skillGraphTopologySignature(view),
    );
  });

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
