import type { SkillGraphViewData } from "./skill-graph-view";

export const SKILL_GRAPH_LAYOUT_BUDGETS = Object.freeze({
  compact: Object.freeze({ links: 64, nodes: 40 }),
  regular: Object.freeze({ links: 96, nodes: 60 }),
});

export const SKILL_GRAPH_DISPLAY_BUDGETS = Object.freeze({
  compact: Object.freeze({ links: 48, nodes: 30 }),
  focus: Object.freeze({ links: 30, nodes: 18 }),
  regular: Object.freeze({ links: 84, nodes: 48 }),
});

export function skillGraphTopologySignature(data: SkillGraphViewData) {
  return JSON.stringify({
    links: data.links,
    nodes: data.nodes.map((node) => {
      const {
        owned: _owned,
        recommendationRank: _recommendationRank,
        recommended: _recommended,
        ...topology
      } = node;
      return topology;
    }),
  });
}

export function skillGraphVisualSignature(data: SkillGraphViewData) {
  return JSON.stringify(
    data.nodes.map(({ id, owned, recommendationRank, recommended }) => ({
      id,
      owned,
      recommendationRank,
      recommended,
    })),
  );
}
