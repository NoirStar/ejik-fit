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
  SKILL_GRAPH_LABEL_FONT_FAMILY,
  skillGraphLinkColor,
  skillGraphLinkWidth,
  skillGraphNodePaint,
} from "@/lib/skill-graph-canvas-style";
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


type LabelBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};


const MAX_VISIBLE_LABELS = 12;


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


function labelBoundsOverlap(left: LabelBounds, right: LabelBounds) {
  return !(
    left.right <= right.left ||
    right.right <= left.left ||
    left.bottom <= right.top ||
    right.bottom <= left.top
  );
}


function drawNode(
  node: SkillForceNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  display: SkillGraphDisplaySettings,
  selectedId: string | null,
  highlight: HighlightState,
  labelEligibleIds: ReadonlySet<string>,
  renderedLabelBounds: LabelBounds[],
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
    3.4,
    (node.val ?? 4) * display.nodeScale * relationScale,
  );
  const shouldLabel =
    node.seed ||
    isSelected ||
    isHovered ||
    (
      labelEligibleIds.has(nodeId) &&
      isRelated &&
      globalScale >= display.labelThreshold
    );
  const dimmed = highlight.nodeIds.size > 0 && !isRelated;
  const paint = skillGraphNodePaint(node, isSelected);

  ctx.save();
  ctx.globalAlpha = dimmed ? 0.16 : 0.96;

  if (paint.ring) {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, radius + 2.1, 0, Math.PI * 2);
    ctx.setLineDash(node.recommended && !node.owned ? [2.4, 1.6] : []);
    ctx.strokeStyle = paint.ring;
    ctx.lineWidth = Math.max(0.8, 1.35 / globalScale);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (isSelected || isHovered) {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, radius + (paint.ring ? 4.2 : 2.5), 0, Math.PI * 2);
    ctx.strokeStyle = isSelected
      ? GRAPH_CANVAS_COLORS.selectedNode
      : GRAPH_CANVAS_COLORS.hoverRing;
    ctx.lineWidth = Math.max(0.7, 1.3 / globalScale);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = paint.fill;
  ctx.shadowBlur = 0;
  ctx.fill();

  if (shouldLabel) {
    const fontSize = isSelected || isHovered ? 7.2 : node.seed ? 6.8 : 6.2;
    const text = node.label;
    const textX = node.x ?? 0;
    const textY = (node.y ?? 0) + radius + fontSize * 1.1;
    ctx.font = `700 ${fontSize}px ${SKILL_GRAPH_LABEL_FONT_FAMILY}`;
    const horizontalPadding = 3 / Math.max(globalScale, 0.01);
    const verticalPadding = 2 / Math.max(globalScale, 0.01);
    const textWidth = ctx.measureText(text).width;
    const bounds = {
      bottom: textY + fontSize / 2 + verticalPadding,
      left: textX - textWidth / 2 - horizontalPadding,
      right: textX + textWidth / 2 + horizontalPadding,
      top: textY - fontSize / 2 - verticalPadding,
    };
    const priorityLabel = node.seed || isSelected || isHovered;
    const collides = renderedLabelBounds.some((existing) =>
      labelBoundsOverlap(existing, bounds),
    );
    if (priorityLabel || !collides) {
      renderedLabelBounds.push(bounds);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = GRAPH_CANVAS_COLORS.labelOutline;
      ctx.shadowBlur = 0;
      ctx.strokeText(text, textX, textY);
      ctx.fillStyle = GRAPH_CANVAS_COLORS.skillLabel;
      ctx.fillText(text, textX, textY);
    }
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
    ? 18
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
    ?.distance(forces.linkDistance)
    .strength(Math.max(0.04, forces.link))
    .iterations(1);

  graph
    .d3Force("center", null)
    .d3Force("x", forceX<SkillForceNode>(0).strength(forces.center))
    .d3Force("y", forceY<SkillForceNode>(0).strength(forces.center))
    .d3Force(
      "collide",
      forceCollide<SkillForceNode>((node) =>
        Math.max(8, (node.val ?? 4) * 1.7),
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
    const strength = 3.8;
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
  const labelEligibleIds = useMemo(
    () => new Set(
      [...data.nodes]
        .sort(
          (left, right) =>
            right.demandCount - left.demandCount ||
            left.id.localeCompare(right.id, "en"),
        )
        .slice(0, MAX_VISIBLE_LABELS)
        .map(({ id }) => id),
    ),
    [data.nodes],
  );
  const adjacencyRef = useRef<SkillGraphAdjacency>(adjacency);
  const highlightRef = useRef<HighlightState>(emptyHighlight());
  const renderedLabelBoundsRef = useRef<LabelBounds[]>([]);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(selectedId);
  const reduceMotionRef = useRef(false);
  const touchInputRef = useRef(false);
  const initialViewReadyRef = useRef(false);
  const readyRef = useRef(false);
  const revealGenerationRef = useRef(0);
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
    let touchCanvas: HTMLCanvasElement | null = null;
    let pinchStart: { distance: number; zoom: number } | null = null;
    let revealFrame = 0;
    let resizeFrame = 0;

    function touchDistance(event: TouchEvent) {
      const first = event.touches.item(0);
      const second = event.touches.item(1);
      if (!first || !second) {
        return 0;
      }
      return Math.hypot(
        second.clientX - first.clientX,
        second.clientY - first.clientY,
      );
    }

    function startPinch(event: TouchEvent) {
      if (event.touches.length !== 2 || !graphRef.current) {
        return;
      }
      pinchStart = {
        distance: touchDistance(event),
        zoom: graphRef.current.zoom(),
      };
    }

    function movePinch(event: TouchEvent) {
      if (event.touches.length !== 2 || !pinchStart || !graphRef.current) {
        return;
      }
      const distance = touchDistance(event);
      if (pinchStart.distance <= 0 || distance <= 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const nextZoom = Math.min(
        9,
        Math.max(0.18, pinchStart.zoom * (distance / pinchStart.distance)),
      );
      graphRef.current.zoom(nextZoom);
    }

    function endPinch(event: TouchEvent) {
      if (event.touches.length < 2) {
        pinchStart = null;
      }
    }

    setMounted(false);
    setReady(false);
    initialViewReadyRef.current = false;
    readyRef.current = false;
    revealGenerationRef.current += 1;
    onReadyChange?.(false);

    const revealGraph = () => {
      const graph = graphRef.current;
      const generation = revealGenerationRef.current;
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
        if (
          cancelled ||
          readyRef.current ||
          !initialViewReadyRef.current ||
          graphRef.current !== graph ||
          revealGenerationRef.current !== generation
        ) {
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
        .enablePanInteraction(!touchInputRef.current)
        .enableZoomInteraction(true)
        .onRenderFramePre(() => {
          renderedLabelBoundsRef.current = [];
        })
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
      touchCanvas = containerRef.current.querySelector("canvas");
      touchCanvas?.addEventListener("touchstart", startPinch, {
        passive: true,
      });
      touchCanvas?.addEventListener("touchmove", movePinch, {
        passive: false,
      });
      touchCanvas?.addEventListener("touchend", endPinch, {
        passive: true,
      });
      touchCanvas?.addEventListener("touchcancel", endPinch, {
        passive: true,
      });
      setMounted(true);

      resizeObserver = new ResizeObserver(() => {
        if (document.visibilityState === "hidden") {
          return;
        }
        window.cancelAnimationFrame(resizeFrame);
        resizeFrame = window.requestAnimationFrame(() => {
          if (!containerRef.current || !graphRef.current) {
            return;
          }
          const nextSize = resolveContainerSize(containerRef.current);
          graphRef.current.width(nextSize.width).height(nextSize.height);
        });
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
      window.cancelAnimationFrame(resizeFrame);
      resizeObserver?.disconnect();
      touchCanvas?.removeEventListener("touchstart", startPinch);
      touchCanvas?.removeEventListener("touchmove", movePinch);
      touchCanvas?.removeEventListener("touchend", endPinch);
      touchCanvas?.removeEventListener("touchcancel", endPinch);
      mountedGraph?._destructor();
      graphRef.current = null;
      revealGraphRef.current = () => undefined;
      hoveredIdRef.current = null;
      highlightRef.current = emptyHighlight();
      initialViewReadyRef.current = false;
      readyRef.current = false;
      revealGenerationRef.current += 1;
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

    initialViewReadyRef.current = false;
    readyRef.current = false;
    revealGenerationRef.current += 1;
    setReady(false);
    onReadyChange?.(false);
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
  }, [data, display.animate, forces, mounted, onReadyChange]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    graph
      .nodeVal((node) => (node.val ?? 3) * display.nodeScale)
      .nodeColor((node) =>
        skillGraphNodePaint(node, selectedIdRef.current === node.id).fill,
      )
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
          labelEligibleIds,
          renderedLabelBoundsRef.current,
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
        return skillGraphLinkWidth(
          link.value,
          display.linkThickness,
          focused,
          linkRelationRatio(link, highlight),
        );
      })
      .linkColor((link) => {
        const highlight = highlightRef.current;
        const focused =
          highlight.linkIds.size === 0 || highlight.linkIds.has(link.id);
        return skillGraphLinkColor(
          link.score,
          focused,
          highlight.linkIds.size > 0 && highlight.linkIds.has(link.id),
        );
      })
      .linkDirectionalArrowLength((link) =>
        display.arrows && link.kind === "skill" ? Math.max(2, display.linkThickness * 3.4) : 0,
      )
      .linkDirectionalArrowColor(() => GRAPH_CANVAS_COLORS.skillLink)
      .linkDirectionalArrowRelPos(0.94)
      .linkCurvature(0.02);

    requestGraphRedraw(graph);
  }, [display, labelEligibleIds, mounted]);

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
        if (containerRef.current) {
          const nextSize = resolveContainerSize(containerRef.current);
          graph.width(nextSize.width).height(nextSize.height);
        }
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
