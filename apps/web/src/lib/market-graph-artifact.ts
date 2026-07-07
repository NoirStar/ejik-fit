import type {
  SkillGraphViewData,
  SkillGraphViewLink,
  SkillGraphViewNode,
} from "./skill-graph-view";


export type MarketGraphNodeKind = "skill" | "posting" | "company" | "domain";


export type MarketGraphEdgeKind = "cooccurrence" | "evidence" | "domain";


export type MarketGraphNode = {
  id: string;
  label: string;
  kind: MarketGraphNodeKind;
  x: number;
  y: number;
  size: number;
  color: string;
  domain?: string;
  degree?: number;
  demandCount?: number;
  owned?: boolean;
};


export type MarketGraphEdge = {
  source: string;
  target: string;
  weight: number;
  kind: MarketGraphEdgeKind;
};


export type MarketGraphArtifact = {
  version: 1;
  generatedAt: string;
  nodes: MarketGraphNode[];
  edges: MarketGraphEdge[];
  meta: {
    source: "skill-graph-view";
    nodeCount: number;
    edgeCount: number;
    skillCount: number;
    evidenceCount: number;
    layout: "precomputed" | "deterministic-radial";
  };
};


export type MarketGraphArtifactOptions = {
  generatedAt?: string;
  positions?: Record<string, { x: number; y: number }>;
};


function fallbackPosition(index: number, total: number) {
  const safeTotal = Math.max(1, total);
  const angle = (index / safeTotal) * Math.PI * 2;
  const radius = 120 + Math.sqrt(index + 1) * 18;
  return {
    x: Math.round(Math.cos(angle) * radius * 1000) / 1000,
    y: Math.round(Math.sin(angle) * radius * 1000) / 1000,
  };
}


function nodeKind(node: SkillGraphViewNode): MarketGraphNodeKind {
  return node.kind;
}


function edgeKind(link: SkillGraphViewLink): MarketGraphEdgeKind {
  return link.kind === "evidence" ? "evidence" : "cooccurrence";
}


function buildDegreeMap(links: SkillGraphViewLink[]) {
  const degrees = new Map<string, number>();
  links.forEach((link) => {
    degrees.set(link.source, (degrees.get(link.source) ?? 0) + 1);
    degrees.set(link.target, (degrees.get(link.target) ?? 0) + 1);
  });
  return degrees;
}


export function buildMarketGraphArtifact(
  view: SkillGraphViewData,
  options: MarketGraphArtifactOptions = {},
): MarketGraphArtifact {
  const degrees = buildDegreeMap(view.links);
  const hasPrecomputedPositions = Boolean(options.positions);

  return {
    version: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    nodes: view.nodes.map((node, index) => {
      const position =
        options.positions?.[node.id] ?? fallbackPosition(index, view.nodes.length);
      return {
        id: node.id,
        label: node.label,
        kind: nodeKind(node),
        x: position.x,
        y: position.y,
        size: node.val,
        color: node.color,
        domain: node.domain,
        degree: degrees.get(node.id) ?? 0,
        demandCount: node.demandCount,
        owned: node.owned,
      };
    }),
    edges: view.links.map((link) => ({
      source: link.source,
      target: link.target,
      weight: link.value,
      kind: edgeKind(link),
    })),
    meta: {
      source: "skill-graph-view",
      nodeCount: view.nodes.length,
      edgeCount: view.links.length,
      skillCount: view.stats.skillCount,
      evidenceCount: view.stats.evidenceCount,
      layout: hasPrecomputedPositions ? "precomputed" : "deterministic-radial",
    },
  };
}
