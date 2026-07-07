import type { MarketGraphArtifact, MarketGraphEdge, MarketGraphNode } from "./market-graph-artifact";


export type GraphLodMode = "node-only" | "hub-labels" | "neighborhood-detail";


export type GraphLodOptions = {
  zoom: number;
  selectedId?: string | null;
  neighborhoodDepth?: number;
  hubLabelLimit?: number;
  lowZoomThreshold?: number;
  highZoomThreshold?: number;
};


export type GraphLodState = {
  mode: GraphLodMode;
  labelNodeIds: string[];
  visibleEdgeIndexes: number[];
  selectedNeighborhoodIds: string[];
};


const DEFAULT_LOW_ZOOM_THRESHOLD = 0.72;
const DEFAULT_HIGH_ZOOM_THRESHOLD = 1.35;
const DEFAULT_HUB_LABEL_LIMIT = 24;
const DEFAULT_NEIGHBORHOOD_DEPTH = 1;


function nodeScore(node: MarketGraphNode) {
  const degree = node.degree ?? 0;
  const demand = node.demandCount ?? 0;
  const ownedBoost = node.owned ? 10 : 0;
  return degree * 3 + demand + node.size * 2 + ownedBoost;
}


function classifyZoom(
  zoom: number,
  lowZoomThreshold: number,
  highZoomThreshold: number,
): GraphLodMode {
  if (zoom < lowZoomThreshold) {
    return "node-only";
  }
  if (zoom < highZoomThreshold) {
    return "hub-labels";
  }
  return "neighborhood-detail";
}


function topHubLabels(nodes: MarketGraphNode[], limit: number) {
  return [...nodes]
    .sort((a, b) => nodeScore(b) - nodeScore(a) || a.id.localeCompare(b.id))
    .slice(0, Math.max(0, limit))
    .map((node) => node.id);
}


function buildAdjacency(edges: MarketGraphEdge[]) {
  const adjacency = new Map<string, Set<string>>();
  edges.forEach((edge) => {
    if (!adjacency.has(edge.source)) {
      adjacency.set(edge.source, new Set());
    }
    if (!adjacency.has(edge.target)) {
      adjacency.set(edge.target, new Set());
    }
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });
  return adjacency;
}


function collectNeighborhood(
  selectedId: string | null | undefined,
  edges: MarketGraphEdge[],
  depth: number,
) {
  if (!selectedId) {
    return new Set<string>();
  }

  const adjacency = buildAdjacency(edges);
  if (!adjacency.has(selectedId)) {
    return new Set<string>([selectedId]);
  }

  const visible = new Set<string>([selectedId]);
  let frontier = new Set<string>([selectedId]);

  for (let level = 0; level < Math.max(0, depth); level += 1) {
    const next = new Set<string>();
    frontier.forEach((id) => {
      adjacency.get(id)?.forEach((neighbor) => {
        if (!visible.has(neighbor)) {
          visible.add(neighbor);
          next.add(neighbor);
        }
      });
    });
    frontier = next;
  }

  return visible;
}


function edgeIndexesInsideNeighborhood(
  edges: MarketGraphEdge[],
  neighborhood: Set<string>,
) {
  if (neighborhood.size === 0) {
    return [];
  }
  return edges.flatMap((edge, index) =>
    neighborhood.has(edge.source) && neighborhood.has(edge.target) ? [index] : [],
  );
}


export function createGraphLodState(
  artifact: MarketGraphArtifact,
  options: GraphLodOptions,
): GraphLodState {
  const lowZoomThreshold =
    options.lowZoomThreshold ?? DEFAULT_LOW_ZOOM_THRESHOLD;
  const highZoomThreshold =
    options.highZoomThreshold ?? DEFAULT_HIGH_ZOOM_THRESHOLD;
  const hubLabelLimit = options.hubLabelLimit ?? DEFAULT_HUB_LABEL_LIMIT;
  const neighborhoodDepth =
    options.neighborhoodDepth ?? DEFAULT_NEIGHBORHOOD_DEPTH;

  const mode = classifyZoom(options.zoom, lowZoomThreshold, highZoomThreshold);

  if (mode === "node-only") {
    return {
      mode,
      labelNodeIds: [],
      visibleEdgeIndexes: [],
      selectedNeighborhoodIds: [],
    };
  }

  if (mode === "hub-labels") {
    return {
      mode,
      labelNodeIds: topHubLabels(artifact.nodes, hubLabelLimit),
      visibleEdgeIndexes: [],
      selectedNeighborhoodIds: [],
    };
  }

  const neighborhood = collectNeighborhood(
    options.selectedId,
    artifact.edges,
    neighborhoodDepth,
  );
  const selectedNeighborhoodIds = [...neighborhood].sort((a, b) =>
    a.localeCompare(b),
  );

  return {
    mode,
    labelNodeIds:
      neighborhood.size > 0
        ? selectedNeighborhoodIds
        : topHubLabels(artifact.nodes, hubLabelLimit),
    visibleEdgeIndexes: edgeIndexesInsideNeighborhood(artifact.edges, neighborhood),
    selectedNeighborhoodIds,
  };
}
