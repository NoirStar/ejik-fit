"use client";

import { CornersOut, Minus, Plus } from "@phosphor-icons/react";
import { forceCollide, forceX, forceY } from "d3-force";
import type {
  ForceLink as D3ForceLink,
  ForceManyBody,
  SimulationLinkDatum,
} from "d3-force";
import { useEffect, useMemo, useRef, useState } from "react";
import type ForceGraph from "force-graph";
import type { GraphData, NodeObject } from "force-graph";

import { formatDomainLabel } from "@/features/career/model";
import { skillGraphAnimationProfile } from "@/lib/skill-graph-animation";
import {
  buildSkillGraphAdjacency,
  buildSkillGraphHighlight,
  type SkillGraphAdjacency,
  type SkillGraphHighlight,
} from "@/lib/skill-graph-relations";
import type {
  SkillGraphViewData,
  SkillGraphViewLink,
  SkillGraphViewNode,
} from "@/lib/skill-graph-view";
import type {
  GraphRendererDisplaySettings,
  GraphRendererForceSettings,
  GraphRendererProps,
} from "@/lib/graph-renderer";
import { GRAPH_CANVAS_COLORS } from "@/styles/design-tokens";
export {
  FORCE_CANVAS_RENDERER as SKILL_GRAPH_FORCE_CANVAS_RENDERER,
} from "@/lib/graph-renderer";


export type SkillGraphDisplaySettings = GraphRendererDisplaySettings;


export type SkillGraphForceSettings = GraphRendererForceSettings;


type SkillForceNode = SkillGraphViewNode & NodeObject;


type SkillForceLink = Omit<SkillGraphViewLink, "source" | "target"> &
  SimulationLinkDatum<SkillForceNode> & {
    source: string | SkillForceNode;
    target: string | SkillForceNode;
  };


type SkillGraphForceCanvasProps = GraphRendererProps;


type ForceGraphInstance = ForceGraph<SkillForceNode, SkillForceLink>;


type HighlightState = SkillGraphHighlight & {
  hoveredId: string | null;
};


function emptyHighlight(): HighlightState {
  return {
    ...buildSkillGraphHighlight(null, new Map()),
    hoveredId: null,
  };
}


function canUseCanvas() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return false;
  }
  if (window.navigator.userAgent.toLowerCase().includes("jsdom")) {
    return false;
  }
  try {
    const context = document.createElement("canvas").getContext?.("2d");
    return Boolean(context);
  } catch {
    return false;
  }
}


function cloneGraphData(data: SkillGraphViewData): GraphData<SkillForceNode, SkillForceLink> {
  return {
    nodes: data.nodes.map((node) => ({ ...node })),
    links: data.links.map((link) => ({
      ...link,
      source: link.source,
      target: link.target,
    })),
  };
}


function getNodeId(node: string | number | SkillForceNode | undefined) {
  if (node === undefined || node === null) {
    return "";
  }
  return typeof node === "object" ? String(node.id ?? "") : String(node);
}


function rgba(hexOrRgba: string, alpha: number) {
  if (hexOrRgba.startsWith("rgba") || hexOrRgba.startsWith("rgb")) {
    return hexOrRgba;
  }
  const hex = hexOrRgba.replace("#", "");
  const bigint = Number.parseInt(hex.length === 3
    ? hex.split("").map((char) => char + char).join("")
    : hex, 16);
  const red = (bigint >> 16) & 255;
  const green = (bigint >> 8) & 255;
  const blue = bigint & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}


function resolveContainerSize(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return {
    width: Math.max(320, Math.round(rect.width || element.clientWidth || 900)),
    height: Math.max(360, Math.round(rect.height || element.clientHeight || 640)),
  };
}


function relatedToHighlight(
  nodeId: string,
  selectedId: string | null,
  highlight: HighlightState,
) {
  if (highlight.nodeIds.size > 0) {
    return highlight.nodeIds.has(nodeId);
  }
  return !selectedId || nodeId === selectedId;
}


function drawNode(
  node: SkillForceNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  display: SkillGraphDisplaySettings,
  selectedId: string | null,
  highlight: HighlightState,
) {
  const nodeId = String(node.id);
  const isSelected = selectedId === nodeId;
  const isHovered = highlight.hoveredId === nodeId;
  const isRelated = relatedToHighlight(nodeId, selectedId, highlight);
  const relationScale =
    highlight.focusId && highlight.focusId !== nodeId
      ? 1 + (highlight.relationRatios.get(nodeId) ?? 0) * 0.22
      : 1;
  const radius = Math.max(
    node.kind === "posting" ? 2.2 : 3.4,
    (node.val ?? 4) * display.nodeScale * relationScale,
  );
  const shouldLabel =
    node.kind === "posting"
      ? isHovered
      : node.seed ||
        isSelected ||
        isHovered ||
        (isRelated && globalScale >= display.labelThreshold);
  const dimmed = highlight.nodeIds.size > 0 && !isRelated;

  ctx.save();
  ctx.globalAlpha = dimmed ? 0.16 : node.kind === "posting" ? 0.7 : 0.96;

  if (isSelected) {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, radius + 5, 0, Math.PI * 2);
    ctx.fillStyle = rgba(node.color, 0.11);
    ctx.fill();
  }

  if (isSelected || isHovered) {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, radius + 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(node.color, isSelected ? 0.78 : 0.58);
    ctx.lineWidth = Math.max(0.7, 1.3 / globalScale);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = node.kind === "posting" ? GRAPH_CANVAS_COLORS.postingNode : node.color;
  ctx.shadowBlur = node.kind === "posting" ? 0 : isSelected || isHovered ? 8 : 0;
  ctx.shadowColor = node.kind === "posting"
    ? GRAPH_CANVAS_COLORS.postingShadow
    : rgba(node.color, 0.2);
  ctx.fill();

  if (shouldLabel) {
    const fontSize = isSelected || isHovered ? 7.2 : node.seed ? 6.8 : 6.2;
    const text = node.label;
    const textX = node.x ?? 0;
    const textY = (node.y ?? 0) + radius + fontSize * 1.1;
    ctx.font = `700 ${fontSize}px var(--font-geist), Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 2.8;
    ctx.strokeStyle = GRAPH_CANVAS_COLORS.labelOutline;
    ctx.shadowBlur = 0;
    ctx.strokeText(text, textX, textY);
    ctx.fillStyle = node.kind === "posting"
      ? GRAPH_CANVAS_COLORS.postingLabel
      : GRAPH_CANVAS_COLORS.skillLabel;
    ctx.fillText(text, textX, textY);
  }

  ctx.restore();
}


function paintPointerArea(
  node: SkillForceNode,
  color: string,
  ctx: CanvasRenderingContext2D,
  touchInput: boolean,
) {
  const minimumRadius = touchInput
    ? node.kind === "posting"
      ? 15
      : 18
    : node.kind === "posting"
      ? 8
      : 12;
  const radius = Math.max(
    minimumRadius,
    (node.val ?? 4) + 7,
  );
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2);
  ctx.fill();
}


function configureForces(
  graph: ForceGraphInstance,
  forces: SkillGraphForceSettings,
) {
  const charge = graph.d3Force("charge") as ForceManyBody<SkillForceNode> | undefined;
  charge?.strength(-forces.repel).distanceMax(860).theta(0.86);

  const link = graph.d3Force("link") as D3ForceLink<
    SkillForceNode,
    SkillForceLink
  > | undefined;
  link
    ?.distance((edge) =>
      edge.kind === "evidence"
        ? Math.max(18, forces.linkDistance * 0.52)
        : forces.linkDistance,
    )
    .strength((edge) =>
      edge.kind === "evidence"
        ? Math.max(0.02, forces.link * 0.28)
        : Math.max(0.04, forces.link),
    )
    .iterations(1);

  graph
    .d3Force("center", null)
    .d3Force("x", forceX<SkillForceNode>(0).strength(forces.center))
    .d3Force("y", forceY<SkillForceNode>(0).strength(forces.center))
    .d3Force(
      "collide",
      forceCollide<SkillForceNode>((node) =>
        Math.max(node.kind === "posting" ? 5 : 8, (node.val ?? 4) * 1.7),
      ).strength(0.22),
    );
}


function configureAnimation(
  graph: ForceGraphInstance,
  animate: boolean,
  reduceMotion: boolean,
) {
  const profile = skillGraphAnimationProfile(reduceMotion);
  graph
    .warmupTicks(profile.warmupTicks)
    .cooldownTicks(profile.cooldownTicks)
    .cooldownTime(profile.cooldownTime)
    .d3AlphaDecay(animate ? 0.045 : 0.06)
    .d3VelocityDecay(animate ? 0.46 : 0.52)
    .autoPauseRedraw(true);
}


function nudgeGraph(graph: ForceGraphInstance, seed: number) {
  graph.graphData().nodes.forEach((node, index) => {
    if (node.fx !== undefined || node.fy !== undefined) {
      return;
    }
    const angle = (((index + 1) * 137.508 + seed * 41) % 360) * (Math.PI / 180);
    const strength = node.kind === "posting" ? 1.6 : 3.8;
    node.vx = (node.vx ?? 0) + Math.cos(angle) * strength;
    node.vy = (node.vy ?? 0) + Math.sin(angle) * strength;
  });
}


function requestGraphRedraw(graph: ForceGraphInstance | null) {
  if (!graph) return;
  const currentZoom = graph.zoom();
  if (Number.isFinite(currentZoom)) {
    graph.zoom(currentZoom);
  }
}


function focusedHighlight(
  focusId: string | null,
  hoveredId: string | null,
  adjacency: SkillGraphAdjacency,
): HighlightState {
  return {
    ...buildSkillGraphHighlight(focusId, adjacency),
    hoveredId,
  };
}


function nodeTooltip(
  node: SkillForceNode,
  adjacency: SkillGraphAdjacency,
  selectedId: string | null,
) {
  if (node.kind === "posting") {
    return `${node.evidence?.company_name ?? node.label} · ${node.evidence?.title ?? "공고"}`;
  }

  const relation = adjacency.get(String(node.id));
  const parts = [
    node.label,
    formatDomainLabel(node.domain),
    `언급 공고 ${node.demandCount}건`,
    `직접 연결 ${relation?.neighborSkillCount ?? 0}개`,
  ];
  if (selectedId && selectedId !== node.id) {
    const count = adjacency
      .get(selectedId)
      ?.cooccurrenceByNode.get(String(node.id));
    if (count) parts.push(`선택 기술과 함께 ${count}건`);
  }
  return parts.join(" · ");
}


function linkRelationRatio(
  link: SkillForceLink,
  highlight: HighlightState,
) {
  if (!highlight.focusId || link.kind !== "skill") return 0;
  const source = getNodeId(link.source);
  const target = getNodeId(link.target);
  if (source === highlight.focusId) {
    return highlight.relationRatios.get(target) ?? 0;
  }
  if (target === highlight.focusId) {
    return highlight.relationRatios.get(source) ?? 0;
  }
  return 0;
}


function skillLinkColor(score: number, emphasized: boolean) {
  const safeScore = Number.isFinite(score)
    ? Math.max(0, Math.min(1, score))
    : 0;
  const alpha = Math.min(0.76, 0.18 + safeScore * 0.42 + (emphasized ? 0.12 : 0));
  return `rgba(86, 56, 198, ${alpha})`;
}


export function SkillGraphForceCanvas({
  data,
  display,
  forces,
  selectedId,
  onNodeSelect,
  onReadyChange,
  reheatKey = 0,
}: SkillGraphForceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphInstance | null>(null);
  const adjacency = useMemo(
    () => buildSkillGraphAdjacency(data.links),
    [data.links],
  );
  const adjacencyRef = useRef<SkillGraphAdjacency>(adjacency);
  const highlightRef = useRef<HighlightState>(emptyHighlight());
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const reduceMotionRef = useRef(false);
  const touchInputRef = useRef(false);
  const initialViewReadyRef = useRef(false);
  const readyRef = useRef(false);
  const revealGraphRef = useRef<() => void>(() => undefined);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  adjacencyRef.current = adjacency;

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (hoveredIdRef.current) return;
    highlightRef.current = focusedHighlight(selectedId, null, adjacency);
    requestGraphRedraw(graphRef.current);
  }, [adjacency, selectedId]);

  useEffect(() => {
    let cancelled = false;
    let mountedGraph: ForceGraphInstance | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let revealFrame = 0;

    setMounted(false);
    setReady(false);
    initialViewReadyRef.current = false;
    readyRef.current = false;
    onReadyChange?.(false);

    const revealGraph = () => {
      const graph = graphRef.current;
      if (
        cancelled ||
        readyRef.current ||
        !initialViewReadyRef.current ||
        !graph ||
        graph.graphData().nodes.length === 0
      ) {
        return;
      }
      window.cancelAnimationFrame(revealFrame);
      revealFrame = window.requestAnimationFrame(() => {
        if (cancelled || readyRef.current || graphRef.current !== graph) {
          return;
        }
        readyRef.current = true;
        setReady(true);
        onReadyChange?.(true);
      });
    };
    revealGraphRef.current = revealGraph;

    async function mount() {
      const element = containerRef.current;
      if (!element || !canUseCanvas()) {
        return;
      }

      reduceMotionRef.current = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      touchInputRef.current =
        window.navigator.maxTouchPoints > 0 ||
        window.matchMedia("(pointer: coarse)").matches;

      const { default: ForceGraphCtor } = await import("force-graph");
      if (cancelled || !containerRef.current) {
        return;
      }

      const size = resolveContainerSize(containerRef.current);
      mountedGraph = new ForceGraphCtor<SkillForceNode, SkillForceLink>(
        containerRef.current,
      )
        .width(size.width)
        .height(size.height)
        .backgroundColor(GRAPH_CANVAS_COLORS.transparent)
        .nodeId("id")
        .linkSource("source")
        .linkTarget("target")
        .minZoom(0.18)
        .maxZoom(9)
        .enableNodeDrag(!touchInputRef.current)
        .enablePanInteraction(true)
        .enableZoomInteraction(true)
        .onEngineTick(revealGraph)
        .onEngineStop(revealGraph)
        .showPointerCursor((object) => Boolean(object))
        .onNodeHover((node) => {
          const hoveredId = node ? String(node.id) : null;
          hoveredIdRef.current = hoveredId;
          highlightRef.current = focusedHighlight(
            hoveredId ?? selectedIdRef.current,
            hoveredId,
            adjacencyRef.current,
          );
          requestGraphRedraw(graphRef.current);
        })
        .onNodeClick((node) => {
          if (node.kind === "skill") {
            const nodeId = String(node.id);
            selectedIdRef.current = nodeId;
            highlightRef.current = focusedHighlight(
              nodeId,
              hoveredIdRef.current,
              adjacencyRef.current,
            );
            onNodeSelect(nodeId);
            if (typeof node.x === "number" && typeof node.y === "number") {
              graphRef.current
                ?.centerAt(node.x, node.y, 420)
                .zoom(touchInputRef.current ? 1.72 : 2.15, 420);
            }
          }
        })
        .onNodeDrag((node) => {
          node.fx = node.x;
          node.fy = node.y;
        })
        .onNodeDragEnd((node) => {
          node.fx = node.x;
          node.fy = node.y;
        });

      graphRef.current = mountedGraph;
      setMounted(true);

      resizeObserver = new ResizeObserver(() => {
        if (!containerRef.current || !graphRef.current) {
          return;
        }
        const nextSize = resolveContainerSize(containerRef.current);
        graphRef.current.width(nextSize.width).height(nextSize.height);
      });
      resizeObserver.observe(containerRef.current);
    }

    mount().catch(() => {
      if (!cancelled) {
        graphRef.current = null;
        setReady(false);
        onReadyChange?.(false);
      }
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(revealFrame);
      resizeObserver?.disconnect();
      mountedGraph?._destructor();
      graphRef.current = null;
      revealGraphRef.current = () => undefined;
      hoveredIdRef.current = null;
      highlightRef.current = emptyHighlight();
      initialViewReadyRef.current = false;
      readyRef.current = false;
      setMounted(false);
      setReady(false);
      onReadyChange?.(false);
    };
  }, [onNodeSelect, onReadyChange]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph.graphData(cloneGraphData(data));
    configureForces(graph, forces);
    configureAnimation(graph, display.animate, reduceMotionRef.current);
    hoveredIdRef.current = null;
    highlightRef.current = focusedHighlight(
      selectedIdRef.current,
      null,
      adjacencyRef.current,
    );
    graph.d3ReheatSimulation();
    if (document.visibilityState === "hidden") {
      graph.pauseAnimation();
    } else {
      graph.resumeAnimation();
    }

    let initialFitTimer = 0;
    if (data.nodes.length > 0) {
      initialFitTimer = window.setTimeout(() => {
        if (!graphRef.current) {
          return;
        }
        if (data.nodes.length <= 3) {
          graphRef.current.centerAt(0, 0).zoom(1.35);
        } else {
          graphRef.current.zoomToFit(0, touchInputRef.current ? 64 : 92);
        }
        initialViewReadyRef.current = true;
        window.requestAnimationFrame(() => revealGraphRef.current());
      }, 80);
    }

    return () => {
      window.clearTimeout(initialFitTimer);
    };
  }, [data, display.animate, forces, mounted]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph
      .nodeVal((node) => (node.val ?? 3) * display.nodeScale)
      .nodeColor((node) => node.color)
      .nodeLabel((node) =>
        nodeTooltip(
          node,
          adjacencyRef.current,
          selectedIdRef.current,
        ),
      )
      .nodeCanvasObject((node, ctx, globalScale) =>
        drawNode(
          node,
          ctx,
          globalScale,
          display,
          selectedIdRef.current,
          highlightRef.current,
        ),
      )
      .nodeCanvasObjectMode(() => "replace")
      .nodePointerAreaPaint((node, color, ctx) =>
        paintPointerArea(node, color, ctx, touchInputRef.current),
      )
      .linkWidth((link) => {
        const highlight = highlightRef.current;
        const focused =
          highlight.linkIds.size === 0 || highlight.linkIds.has(link.id);
        const base = Math.max(0.18, link.value * display.linkThickness);
        if (!focused) return Math.max(0.05, base * 0.2);
        return Math.min(6, base * (1 + linkRelationRatio(link, highlight) * 0.35));
      })
      .linkColor((link) => {
        const highlight = highlightRef.current;
        const focused =
          highlight.linkIds.size === 0 || highlight.linkIds.has(link.id);
        if (!focused) {
          return GRAPH_CANVAS_COLORS.dimmedLink;
        }
        if (link.kind === "evidence") {
          return GRAPH_CANVAS_COLORS.evidenceLink;
        }
        return skillLinkColor(
          link.score,
          highlight.linkIds.size > 0 && highlight.linkIds.has(link.id),
        );
      })
      .linkDirectionalArrowLength((link) =>
        display.arrows && link.kind === "skill" ? Math.max(2, display.linkThickness * 3.4) : 0,
      )
      .linkDirectionalArrowColor(() => GRAPH_CANVAS_COLORS.skillLink)
      .linkDirectionalArrowRelPos(0.94)
      .linkCurvature((link) => (link.kind === "evidence" ? 0.08 : 0.02));

    requestGraphRedraw(graph);
  }, [display, mounted]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || data.nodes.length === 0 || reheatKey === 0) {
      return;
    }
    nudgeGraph(graph, reheatKey);
    configureAnimation(graph, display.animate, reduceMotionRef.current);
    graph.d3ReheatSimulation();
    if (document.visibilityState !== "hidden") {
      graph.resumeAnimation();
    }
  }, [reheatKey, mounted]);

  useEffect(() => {
    function syncVisibility() {
      const graph = graphRef.current;
      if (!graph) return;
      if (document.visibilityState === "hidden") {
        graph.pauseAnimation();
      } else {
        graph.resumeAnimation();
        requestGraphRedraw(graph);
      }
    }

    document.addEventListener("visibilitychange", syncVisibility);
    return () => document.removeEventListener("visibilitychange", syncVisibility);
  }, [mounted]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || !selectedId) {
      return;
    }
    const selected = graph.graphData().nodes.find((node) => node.id === selectedId);
    if (selected && typeof selected.x === "number" && typeof selected.y === "number") {
      graph.centerAt(selected.x, selected.y, 420).zoom(2.05, 420);
    }
  }, [selectedId, ready]);

  function changeZoom(multiplier: number) {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    const nextZoom = Math.min(9, Math.max(0.18, graph.zoom() * multiplier));
    graph.zoom(nextZoom, 220);
  }

  function fitGraph() {
    graphRef.current?.zoomToFit(360, touchInputRef.current ? 64 : 92);
  }

  return (
    <div className={`force-canvas ${ready ? "force-canvas--ready" : ""}`}>
      <div aria-hidden="true" className="force-canvas__surface" ref={containerRef} />
      <div aria-label="그래프 보기 조절" className="force-canvas__controls" role="group">
        <button
          aria-label="그래프 축소"
          disabled={!ready}
          onClick={() => changeZoom(0.78)}
          type="button"
        >
          <Minus aria-hidden="true" size={17} />
        </button>
        <button
          aria-label="그래프 전체 맞춤"
          disabled={!ready}
          onClick={fitGraph}
          type="button"
        >
          <CornersOut aria-hidden="true" size={17} />
        </button>
        <button
          aria-label="그래프 확대"
          disabled={!ready}
          onClick={() => changeZoom(1.28)}
          type="button"
        >
          <Plus aria-hidden="true" size={17} />
        </button>
      </div>
    </div>
  );
}
