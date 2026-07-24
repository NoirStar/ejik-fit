import { GRAPH_DEFAULT_COLOR } from "@/styles/design-tokens";

import { domainColor } from "./skill-graph";
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
  query?: string;
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
  overview: { nodes: 12, links: 18 },
  focus: { nodes: 9, links: 12 },
  all: { nodes: 30, links: 45 },
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
  return clamp(4.5 + ratio * 4.5, 4.5, 9);
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

  const result = [selected];
  const seen = new Set([selected.id]);
  for (const { neighbor } of incident) {
    if (seen.has(neighbor.id)) {
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
    selectedNodes = [...candidates].sort(compareNodes).slice(0, nodeLimit);
  }

  const visibleIds = new Set(selectedNodes.map(({ id }) => id));
  const selectedEdges = sparseBackbone(candidateEdges, visibleIds, linkLimit);
  const maximumDemand = Math.max(
    1,
    ...graph.nodes.map((node) => safeCount(node.demand_count)),
  );
  const nodes = selectedNodes.map<SkillGraphViewNode>((node) => {
    const domain = primaryDomain(node);
    return {
      id: node.id,
      label: node.label,
      kind: "skill",
      category: node.category,
      domain,
      domains: node.domains,
      color: GRAPH_DEFAULT_COLOR,
      val: skillNodeValue(node, maximumDemand),
      demandCount: safeCount(node.demand_count),
      owned: node.owned,
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
