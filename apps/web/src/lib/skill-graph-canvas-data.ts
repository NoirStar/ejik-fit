import type { SkillGraphViewData } from "./skill-graph-view";

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
