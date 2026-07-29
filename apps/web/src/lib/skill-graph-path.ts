import type {
  SkillGraphViewLink,
  SkillGraphViewNode,
} from "./skill-graph-view";


export type SkillGraphMarketPath = {
  nodeIds: string[];
  linkIds: string[];
  sourceId: string;
  targetId: string;
  hopCount: number;
  weakestCooccurrenceCount: number;
  averageScore: number;
};


export type FindStrongestSkillGraphPathOptions = {
  nodes: readonly SkillGraphViewNode[];
  links: readonly SkillGraphViewLink[];
  sourceIds: readonly string[];
  targetId: string;
  maxHops?: number;
};


type PathState = {
  cost: number;
  linkIds: string[];
  links: SkillGraphViewLink[];
  nodeId: string;
  nodeIds: string[];
  signature: string;
};


function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}


function edgeCost(link: SkillGraphViewLink) {
  const score = Number.isFinite(link.score) ? clamp(link.score, 0, 1) : 0;
  const count = Number.isFinite(link.cooccurrenceCount)
    ? Math.max(0, link.cooccurrenceCount)
    : 0;
  return 1 + (1 - score) * 4 + 1 / Math.sqrt(count + 1);
}


function compareStates(left: PathState, right: PathState) {
  return (
    left.cost - right.cost ||
    left.linkIds.length - right.linkIds.length ||
    left.signature.localeCompare(right.signature, "en")
  );
}


function otherNodeId(link: SkillGraphViewLink, nodeId: string) {
  if (link.source === nodeId) return link.target;
  if (link.target === nodeId) return link.source;
  return null;
}


function toMarketPath(state: PathState, targetId: string): SkillGraphMarketPath {
  const scoreTotal = state.links.reduce(
    (total, link) => total + clamp(link.score, 0, 1),
    0,
  );
  return {
    nodeIds: state.nodeIds,
    linkIds: state.linkIds,
    sourceId: state.nodeIds[0]!,
    targetId,
    hopCount: state.linkIds.length,
    weakestCooccurrenceCount: state.links.length > 0
      ? Math.min(...state.links.map((link) => Math.max(0, link.cooccurrenceCount)))
      : 0,
    averageScore: state.links.length > 0
      ? scoreTotal / state.links.length
      : 0,
  };
}


export function findStrongestSkillGraphPath({
  nodes,
  links,
  sourceIds,
  targetId,
  maxHops = 4,
}: FindStrongestSkillGraphPathOptions): SkillGraphMarketPath | null {
  const nodeIds = new Set(
    nodes.filter(({ kind }) => kind === "skill").map(({ id }) => id),
  );
  if (!nodeIds.has(targetId)) return null;

  const validSources = [...new Set(sourceIds)]
    .filter((sourceId) => nodeIds.has(sourceId))
    .sort((left, right) => left.localeCompare(right, "en"));
  if (validSources.length === 0) return null;
  if (validSources.includes(targetId)) {
    return {
      nodeIds: [targetId],
      linkIds: [],
      sourceId: targetId,
      targetId,
      hopCount: 0,
      weakestCooccurrenceCount: 0,
      averageScore: 0,
    };
  }

  const hopCeiling = clamp(Math.floor(maxHops), 1, 8);
  const adjacency = new Map<string, SkillGraphViewLink[]>();
  for (const link of links) {
    if (
      link.kind !== "skill" ||
      !nodeIds.has(link.source) ||
      !nodeIds.has(link.target)
    ) {
      continue;
    }
    adjacency.set(link.source, [...(adjacency.get(link.source) ?? []), link]);
    adjacency.set(link.target, [...(adjacency.get(link.target) ?? []), link]);
  }
  adjacency.forEach((incident) => {
    incident.sort((left, right) => left.id.localeCompare(right.id, "en"));
  });

  const queue = validSources.map<PathState>((sourceId) => ({
    cost: 0,
    linkIds: [],
    links: [],
    nodeId: sourceId,
    nodeIds: [sourceId],
    signature: sourceId,
  }));
  const bestCosts = new Map<string, number>();

  while (queue.length > 0) {
    queue.sort(compareStates);
    const current = queue.shift()!;
    const stateKey = `${current.nodeId}:${current.linkIds.length}`;
    const knownCost = bestCosts.get(stateKey);
    if (knownCost !== undefined && current.cost > knownCost) continue;
    bestCosts.set(stateKey, current.cost);

    if (current.nodeId === targetId) {
      return toMarketPath(current, targetId);
    }
    if (current.linkIds.length >= hopCeiling) continue;

    for (const link of adjacency.get(current.nodeId) ?? []) {
      const nextNodeId = otherNodeId(link, current.nodeId);
      if (!nextNodeId || current.nodeIds.includes(nextNodeId)) continue;
      const nextLinkIds = [...current.linkIds, link.id];
      const nextNodeIds = [...current.nodeIds, nextNodeId];
      const nextCost = current.cost + edgeCost(link);
      const nextKey = `${nextNodeId}:${nextLinkIds.length}`;
      const bestNextCost = bestCosts.get(nextKey);
      if (bestNextCost !== undefined && nextCost >= bestNextCost) continue;
      queue.push({
        cost: nextCost,
        linkIds: nextLinkIds,
        links: [...current.links, link],
        nodeId: nextNodeId,
        nodeIds: nextNodeIds,
        signature: `${current.signature}>${link.id}>${nextNodeId}`,
      });
    }
  }

  return null;
}
