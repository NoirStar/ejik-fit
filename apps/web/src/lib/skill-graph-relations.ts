import type { SkillGraphViewLink } from "./skill-graph-view";

export type SkillGraphNodeRelations = {
  nodeIds: ReadonlySet<string>;
  linkIds: ReadonlySet<string>;
  cooccurrenceByNode: ReadonlyMap<string, number>;
  maxCooccurrenceCount: number;
  neighborSkillCount: number;
};

export type SkillGraphAdjacency = ReadonlyMap<
  string,
  SkillGraphNodeRelations
>;

export type SkillGraphHighlight = {
  focusId: string | null;
  nodeIds: ReadonlySet<string>;
  linkIds: ReadonlySet<string>;
  relationRatios: ReadonlyMap<string, number>;
  maxCooccurrenceCount: number;
};

type MutableNodeRelations = {
  nodeIds: Set<string>;
  linkIds: Set<string>;
  cooccurrenceByNode: Map<string, number>;
  neighborSkillIds: Set<string>;
  maxCooccurrenceCount: number;
};

function mutableRelations(
  adjacency: Map<string, MutableNodeRelations>,
  nodeId: string,
) {
  const current = adjacency.get(nodeId);
  if (current) return current;
  const created: MutableNodeRelations = {
    nodeIds: new Set(),
    linkIds: new Set(),
    cooccurrenceByNode: new Map(),
    neighborSkillIds: new Set(),
    maxCooccurrenceCount: 0,
  };
  adjacency.set(nodeId, created);
  return created;
}

function connect(
  adjacency: Map<string, MutableNodeRelations>,
  nodeId: string,
  neighborId: string,
  link: SkillGraphViewLink,
) {
  const relation = mutableRelations(adjacency, nodeId);
  relation.nodeIds.add(neighborId);
  relation.linkIds.add(link.id);
  if (link.kind !== "skill") return;

  const count = Number.isFinite(link.cooccurrenceCount)
    ? Math.max(0, link.cooccurrenceCount)
    : 0;
  relation.neighborSkillIds.add(neighborId);
  relation.cooccurrenceByNode.set(
    neighborId,
    Math.max(relation.cooccurrenceByNode.get(neighborId) ?? 0, count),
  );
  relation.maxCooccurrenceCount = Math.max(
    relation.maxCooccurrenceCount,
    count,
  );
}

export function buildSkillGraphAdjacency(
  links: readonly SkillGraphViewLink[],
): SkillGraphAdjacency {
  const mutable = new Map<string, MutableNodeRelations>();
  for (const link of links) {
    connect(mutable, link.source, link.target, link);
    connect(mutable, link.target, link.source, link);
  }

  return new Map(
    Array.from(mutable, ([nodeId, relation]) => [
      nodeId,
      {
        nodeIds: relation.nodeIds,
        linkIds: relation.linkIds,
        cooccurrenceByNode: relation.cooccurrenceByNode,
        maxCooccurrenceCount: relation.maxCooccurrenceCount,
        neighborSkillCount: relation.neighborSkillIds.size,
      },
    ]),
  );
}

export function buildSkillGraphHighlight(
  focusId: string | null,
  adjacency: SkillGraphAdjacency,
): SkillGraphHighlight {
  const relation = focusId ? adjacency.get(focusId) : undefined;
  if (!focusId || !relation) {
    return {
      focusId: null,
      nodeIds: new Set(),
      linkIds: new Set(),
      relationRatios: new Map(),
      maxCooccurrenceCount: 0,
    };
  }

  const relationRatios = new Map<string, number>();
  for (const nodeId of relation.nodeIds) {
    const cooccurrenceCount = relation.cooccurrenceByNode.get(nodeId) ?? 0;
    relationRatios.set(
      nodeId,
      relation.maxCooccurrenceCount > 0
        ? Math.sqrt(cooccurrenceCount / relation.maxCooccurrenceCount)
        : 0,
    );
  }

  return {
    focusId,
    nodeIds: new Set([focusId, ...relation.nodeIds]),
    linkIds: new Set(relation.linkIds),
    relationRatios,
    maxCooccurrenceCount: relation.maxCooccurrenceCount,
  };
}
