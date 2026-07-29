import { domainColor } from "./skill-graph";
import { skillIdentityKey } from "./skill-catalog";
import type {
  SkillGraphEdge,
  SkillGraphEvidence,
  SkillGraphNode,
  SkillGraphResponse,
} from "./types";


export type SkillGraphViewMode = "overview" | "focus" | "all";


export type SkillGraphViewOptions = {
  enabledDomains?: string[];
  linkLimit?: number;
  mode?: SkillGraphViewMode;
  nodeLimit?: number;
  ownedIds?: readonly string[];
  query?: string;
  recommendedIds?: readonly string[];
  selectedId?: string | null;
};


export type SkillGraphViewNode = {
  id: string;
  label: string;
  kind: "skill" | "posting";
  category: string;
  domain: string;
  domains: string[];
  color: string;
  val: number;
  demandCount: number;
  owned: boolean;
  recommended: boolean;
  recommendationRank: number | null;
  seed: boolean;
  evidence?: SkillGraphEvidence;
  skill?: SkillGraphNode;
};


export type SkillGraphViewLink = {
  id: string;
  source: string;
  target: string;
  kind: "skill" | "evidence";
  cooccurrenceCount: number;
  score: number;
  value: number;
};


export type SkillGraphViewDomain = {
  domain: string;
  label: string;
  count: number;
  color: string;
  enabled: boolean;
};


export type SkillGraphViewData = {
  nodes: SkillGraphViewNode[];
  links: SkillGraphViewLink[];
  domains: SkillGraphViewDomain[];
  stats: {
    skillCount: number;
    evidenceCount: number;
    linkCount: number;
  };
};


const DEFAULT_LIMITS: Record<
  SkillGraphViewMode,
  { nodes: number; links: number }
> = {
  overview: { nodes: 36, links: 60 },
  focus: { nodes: 18, links: 30 },
  all: { nodes: 48, links: 84 },
};


function normalizeQuery(query: string | undefined) {
  return query?.trim().toLocaleLowerCase("ko-KR") ?? "";
}


function primaryDomain(node: SkillGraphNode) {
  return node.domains[0] ?? "unknown";
}


function formatDomainLabel(domain: string) {
  return domain.replace(/_/g, " ");
}


function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}


function safeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}


function boundedLimit(value: number | undefined, fallback: number) {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(1, Math.floor(value));
}


function compareNames(left: string, right: string) {
  return left.localeCompare(right, "en");
}


function compareNodes(left: SkillGraphNode, right: SkillGraphNode) {
  return (
    safeCount(right.demand_count) - safeCount(left.demand_count) ||
    safeCount(right.required_count) - safeCount(left.required_count) ||
    compareNames(left.id, right.id)
  );
}


function compareEdges(left: SkillGraphEdge, right: SkillGraphEdge) {
  return (
    clamp(right.score, 0, 1) - clamp(left.score, 0, 1) ||
    safeCount(right.cooccurrence_count) - safeCount(left.cooccurrence_count) ||
    compareNames(left.id, right.id)
  );
}


function skillNodeValue(node: SkillGraphNode, maximumDemand: number) {
  const denominator = Math.log1p(Math.max(1, maximumDemand));
  const ratio = Math.log1p(safeCount(node.demand_count)) / denominator;
  return clamp(3.8 + ratio * 8.7, 4, 12.5);
}


function linkValue(score: number) {
  return clamp(0.6 + clamp(Number.isFinite(score) ? score : 0, 0, 1) * 0.4, 0.6, 1);
}


function buildDomainStats(
  graph: SkillGraphResponse,
  enabledDomains: string[] | undefined,
): SkillGraphViewDomain[] {
  const counts = new Map<string, number>();
  graph.nodes.forEach((node) => {
    const domain = primaryDomain(node);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  });

  const enabledSet = enabledDomains === undefined ? null : new Set(enabledDomains);
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || compareNames(left[0], right[0]))
    .map(([domain, count]) => ({
      domain,
      label: formatDomainLabel(domain),
      count,
      color: domainColor(domain),
      enabled: enabledSet ? enabledSet.has(domain) : true,
    }));
}


function matchesQuery(node: SkillGraphNode, query: string) {
  if (!query) {
    return true;
  }
  return [node.id, node.label, node.category, node.kind, ...node.domains]
    .join(" ")
    .toLocaleLowerCase("ko-KR")
    .includes(query);
}


function selectFocusNodes(
  candidates: SkillGraphNode[],
  edges: SkillGraphEdge[],
  selectedId: string | null | undefined,
  limit: number,
) {
  const byId = new Map(candidates.map((node) => [node.id, node]));
  const selected = selectedId ? byId.get(selectedId) : undefined;
  if (!selected) {
    return [...candidates].sort(compareNodes).slice(0, limit);
  }

  const incident = edges
    .filter((edge) => edge.source === selected.id || edge.target === selected.id)
    .map((edge) => {
      const neighborId = edge.source === selected.id ? edge.target : edge.source;
      return { edge, neighbor: byId.get(neighborId) };
    })
    .filter(
      (item): item is { edge: SkillGraphEdge; neighbor: SkillGraphNode } =>
        item.neighbor !== undefined,
    )
    .sort(
      (left, right) =>
        compareEdges(left.edge, right.edge) ||
        compareNodes(left.neighbor, right.neighbor),
    );

  const directNeighbors: SkillGraphNode[] = [];
  const directIds = new Set<string>();
  for (const { neighbor } of incident) {
    if (directIds.has(neighbor.id)) {
      continue;
    }
    directNeighbors.push(neighbor);
    directIds.add(neighbor.id);
  }

  const secondConnections = edges
    .map((edge) => {
      const sourceIsDirect = directIds.has(edge.source);
      const targetIsDirect = directIds.has(edge.target);
      if (sourceIsDirect === targetIsDirect) {
        return null;
      }
      const parentId = sourceIsDirect ? edge.source : edge.target;
      const neighborId = sourceIsDirect ? edge.target : edge.source;
      if (neighborId === selected.id || directIds.has(neighborId)) {
        return null;
      }
      const neighbor = byId.get(neighborId);
      return neighbor ? { edge, neighbor, parentId } : null;
    })
    .filter(
      (item): item is {
        edge: SkillGraphEdge;
        neighbor: SkillGraphNode;
        parentId: string;
      } =>
        item !== null,
    )
    .sort(
      (left, right) =>
        compareEdges(left.edge, right.edge) ||
        compareNodes(left.neighbor, right.neighbor),
    );
  const capacity = Math.max(0, limit - 1);
  const secondTarget = secondConnections.length > 0
    ? Math.max(1, Math.floor(capacity * 0.35))
    : 0;
  const selectedSecond: SkillGraphNode[] = [];
  const selectedSecondIds = new Set<string>();
  const requiredParentIds = new Set<string>();
  for (const { neighbor, parentId } of secondConnections) {
    if (
      selectedSecond.length >= secondTarget ||
      selectedSecondIds.has(neighbor.id)
    ) {
      continue;
    }
    const addedParentCost = requiredParentIds.has(parentId) ? 0 : 1;
    if (
      selectedSecond.length + requiredParentIds.size + addedParentCost + 1 >
      capacity
    ) {
      continue;
    }
    selectedSecond.push(neighbor);
    selectedSecondIds.add(neighbor.id);
    requiredParentIds.add(parentId);
  }

  const directCapacity = Math.max(0, capacity - selectedSecond.length);
  const visibleDirect = directNeighbors
    .filter((node) => requiredParentIds.has(node.id));
  const visibleDirectIds = new Set(visibleDirect.map(({ id }) => id));
  for (const node of directNeighbors) {
    if (visibleDirect.length >= directCapacity) {
      break;
    }
    if (!visibleDirectIds.has(node.id)) {
      visibleDirect.push(node);
      visibleDirectIds.add(node.id);
    }
  }

  return [
    selected,
    ...visibleDirect,
    ...selectedSecond,
  ];
}


function selectQueryNodes(
  candidates: SkillGraphNode[],
  edges: SkillGraphEdge[],
  query: string,
  limit: number,
) {
  const byId = new Map(candidates.map((node) => [node.id, node]));
  const matches = candidates.filter((node) => matchesQuery(node, query)).sort(compareNodes);
  const result = matches.slice(0, limit);
  const seen = new Set(result.map(({ id }) => id));
  const matchIds = new Set(matches.map(({ id }) => id));

  for (const edge of [...edges].sort(compareEdges)) {
    const sourceMatches = matchIds.has(edge.source);
    const targetMatches = matchIds.has(edge.target);
    if (sourceMatches === targetMatches) {
      continue;
    }
    const neighborId = sourceMatches ? edge.target : edge.source;
    const neighbor = byId.get(neighborId);
    if (!neighbor || seen.has(neighbor.id)) {
      continue;
    }
    result.push(neighbor);
    seen.add(neighbor.id);
    if (result.length >= limit) {
      break;
    }
  }
  return result;
}


function selectAtlasNodes(
  candidates: SkillGraphNode[],
  selectedId: string | null | undefined,
  limit: number,
) {
  const ranked = [...candidates].sort(compareNodes);
  const visible = ranked.slice(0, limit);
  const selectedIdentity = selectedId ? skillIdentityKey(selectedId) : "";
  if (!selectedIdentity) return visible;

  const selected = ranked.find(
    (node) => skillIdentityKey(node.id) === selectedIdentity,
  );
  if (
    !selected ||
    visible.some((node) => skillIdentityKey(node.id) === selectedIdentity)
  ) {
    return visible;
  }

  visible[Math.max(0, visible.length - 1)] = selected;
  return visible.sort(compareNodes);
}


class DisjointSet {
  private readonly parents = new Map<string, string>();

  constructor(ids: Set<string>) {
    ids.forEach((id) => this.parents.set(id, id));
  }

  find(id: string): string {
    const parent = this.parents.get(id) ?? id;
    if (parent === id) {
      return id;
    }
    const root = this.find(parent);
    this.parents.set(id, root);
    return root;
  }

  join(left: string, right: string) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) {
      return false;
    }
    this.parents.set(rightRoot, leftRoot);
    return true;
  }
}


function sparseBackbone(
  edges: SkillGraphEdge[],
  visibleIds: Set<string>,
  limit: number,
) {
  const ranked = edges
    .filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    )
    .sort(compareEdges);
  const disjointSet = new DisjointSet(visibleIds);
  const selected: SkillGraphEdge[] = [];
  const selectedIds = new Set<string>();

  for (const edge of ranked) {
    if (!disjointSet.join(edge.source, edge.target)) {
      continue;
    }
    selected.push(edge);
    selectedIds.add(edge.id);
    if (selected.length >= limit) {
      return selected;
    }
  }

  for (const edge of ranked) {
    if (selectedIds.has(edge.id)) {
      continue;
    }
    selected.push(edge);
    if (selected.length >= limit) {
      break;
    }
  }
  return selected;
}


function focusBackbone(
  edges: SkillGraphEdge[],
  visibleIds: Set<string>,
  selectedId: string | null | undefined,
  limit: number,
) {
  if (!selectedId || !visibleIds.has(selectedId)) {
    return sparseBackbone(edges, visibleIds, limit);
  }

  const visibleEdges = edges.filter(
    (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
  );
  const directEdges = visibleEdges
    .filter(
      (edge) => edge.source === selectedId || edge.target === selectedId,
    )
    .sort(compareEdges)
    .slice(0, limit);
  if (directEdges.length >= limit) {
    return directEdges;
  }

  const directIds = new Set(directEdges.map(({ id }) => id));
  const contextualEdges = sparseBackbone(
    visibleEdges.filter((edge) => !directIds.has(edge.id)),
    visibleIds,
    limit - directEdges.length,
  );
  return [...directEdges, ...contextualEdges];
}


export function buildSkillGraphView(
  graph: SkillGraphResponse,
  options: SkillGraphViewOptions = {},
): SkillGraphViewData {
  const mode = options.mode ?? "overview";
  const defaults = DEFAULT_LIMITS[mode];
  const nodeLimit = boundedLimit(options.nodeLimit, defaults.nodes);
  const linkLimit = boundedLimit(options.linkLimit, defaults.links);
  const enabledSet =
    options.enabledDomains === undefined ? null : new Set(options.enabledDomains);
  const candidates = graph.nodes.filter((node) => {
    const domain = primaryDomain(node);
    return enabledSet ? enabledSet.has(domain) : true;
  });
  const candidateIds = new Set(candidates.map(({ id }) => id));
  const candidateEdges = graph.edges.filter(
    (edge) => candidateIds.has(edge.source) && candidateIds.has(edge.target),
  );
  const query = normalizeQuery(options.query);

  let selectedNodes: SkillGraphNode[];
  if (query) {
    selectedNodes = selectQueryNodes(candidates, candidateEdges, query, nodeLimit);
  } else if (mode === "focus") {
    selectedNodes = selectFocusNodes(
      candidates,
      candidateEdges,
      options.selectedId,
      nodeLimit,
    );
  } else {
    selectedNodes = selectAtlasNodes(candidates, options.selectedId, nodeLimit);
  }

  const visibleIds = new Set(selectedNodes.map(({ id }) => id));
  const selectedEdges = mode === "focus"
    ? focusBackbone(
        candidateEdges,
        visibleIds,
        options.selectedId,
        linkLimit,
      )
    : sparseBackbone(candidateEdges, visibleIds, linkLimit);
  const maximumDemand = Math.max(
    1,
    ...graph.nodes.map((node) => safeCount(node.demand_count)),
  );
  const recommendationRanks = new Map<string, number>();
  (options.recommendedIds ?? []).forEach((id, index) => {
    const key = skillIdentityKey(id);
    if (!recommendationRanks.has(key)) {
      recommendationRanks.set(key, index + 1);
    }
  });
  const ownedIds = options.ownedIds
    ? new Set(options.ownedIds.map(skillIdentityKey))
    : null;
  const nodes = selectedNodes.map<SkillGraphViewNode>((node) => {
    const domain = primaryDomain(node);
    const identityKey = skillIdentityKey(node.id);
    const recommendationRank = recommendationRanks.get(identityKey) ?? null;
    return {
      id: node.id,
      label: node.label,
      kind: "skill",
      category: node.category,
      domain,
      domains: node.domains,
      color: domainColor(domain),
      val: skillNodeValue(node, maximumDemand),
      demandCount: safeCount(node.demand_count),
      owned: ownedIds ? ownedIds.has(identityKey) : node.owned,
      recommended: recommendationRank !== null && recommendationRank <= 3,
      recommendationRank:
        recommendationRank !== null && recommendationRank <= 3
          ? recommendationRank
          : null,
      seed: node.seed,
      skill: node,
    };
  });
  const links = selectedEdges.map<SkillGraphViewLink>((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    kind: "skill",
    cooccurrenceCount: safeCount(edge.cooccurrence_count),
    score: clamp(Number.isFinite(edge.score) ? edge.score : 0, 0, 1),
    value: linkValue(edge.score),
  }));

  return {
    nodes,
    links,
    domains: buildDomainStats(graph, options.enabledDomains),
    stats: {
      skillCount: nodes.length,
      evidenceCount: 0,
      linkCount: links.length,
    },
  };
}
