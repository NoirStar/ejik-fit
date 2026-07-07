import type { ReactNode } from "react";

import type { SkillGraphViewData } from "./skill-graph-view";


export type GraphRendererDisplaySettings = {
  animate: boolean;
  arrows: boolean;
  labelThreshold: number;
  linkThickness: number;
  nodeScale: number;
};


export type GraphRendererForceSettings = {
  center: number;
  link: number;
  linkDistance: number;
  repel: number;
};


export type GraphRendererProps = {
  data: SkillGraphViewData;
  display: GraphRendererDisplaySettings;
  forces: GraphRendererForceSettings;
  selectedId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onReadyChange?: (ready: boolean) => void;
  reheatKey?: number;
};


export type GraphRenderer = (props: GraphRendererProps) => ReactNode;


export type GraphRendererAdapter = {
  id: string;
  label: string;
  engine: "canvas-2d" | "webgl" | "server-artifact";
  maxRecommendedNodes: number;
  supportsLargeGraph: boolean;
  supportsLiveForces: boolean;
};


export type GraphRendererSelection = {
  adapter: GraphRendererAdapter;
  nodeCount: number;
  needsLargeGraphRenderer: boolean;
  reason: "within-budget" | "large-renderer-available" | "large-renderer-needed";
};


export const LARGE_GRAPH_RENDERER_THRESHOLD = 5_000;


export const FORCE_CANVAS_RENDERER: GraphRendererAdapter = {
  id: "force-canvas",
  label: "Force Canvas",
  engine: "canvas-2d",
  maxRecommendedNodes: LARGE_GRAPH_RENDERER_THRESHOLD,
  supportsLargeGraph: false,
  supportsLiveForces: true,
};


export function getGraphNodeCount(graph: SkillGraphViewData | number) {
  return typeof graph === "number" ? graph : graph.nodes.length;
}


export function shouldUseLargeGraphRenderer(
  graph: SkillGraphViewData | number,
  threshold = LARGE_GRAPH_RENDERER_THRESHOLD,
) {
  return getGraphNodeCount(graph) >= threshold;
}


export function selectGraphRenderer(
  graph: SkillGraphViewData | number,
  adapters: GraphRendererAdapter[] = [FORCE_CANVAS_RENDERER],
  threshold = LARGE_GRAPH_RENDERER_THRESHOLD,
): GraphRendererSelection {
  const nodeCount = getGraphNodeCount(graph);
  const needsLargeGraphRenderer = shouldUseLargeGraphRenderer(nodeCount, threshold);

  if (!needsLargeGraphRenderer) {
    return {
      adapter: adapters[0] ?? FORCE_CANVAS_RENDERER,
      nodeCount,
      needsLargeGraphRenderer,
      reason: "within-budget",
    };
  }

  const largeRenderer = adapters.find(
    (adapter) =>
      adapter.supportsLargeGraph && adapter.maxRecommendedNodes >= nodeCount,
  );

  return {
    adapter: largeRenderer ?? adapters[0] ?? FORCE_CANVAS_RENDERER,
    nodeCount,
    needsLargeGraphRenderer,
    reason: largeRenderer ? "large-renderer-available" : "large-renderer-needed",
  };
}
