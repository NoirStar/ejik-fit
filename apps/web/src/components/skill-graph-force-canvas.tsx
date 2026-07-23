"use client";

import { CornersOut, Minus, Plus } from "@phosphor-icons/react";
import { forceCollide, forceX, forceY } from "d3-force";
import type {
  ForceLink as D3ForceLink,
  ForceManyBody,
  SimulationLinkDatum,
} from "d3-force";
import { useEffect, useRef, useState } from "react";
import type ForceGraph from "force-graph";
import type { GraphData, NodeObject } from "force-graph";

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


type HighlightState = {
  nodeId: string | null;
  nodes: Set<string>;
  links: Set<string>;
};


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
  if (highlight.nodes.size > 0) {
    return highlight.nodes.has(nodeId);
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
  const isHovered = highlight.nodeId === nodeId;
  const isRelated = relatedToHighlight(nodeId, selectedId, highlight);
  const radius = Math.max(
    node.kind === "posting" ? 2.2 : 3.4,
    (node.val ?? 4) * display.nodeScale * (isHovered ? 1.18 : 1),
  );
  const shouldLabel =
    node.kind === "posting"
      ? isHovered
      : node.seed ||
        isSelected ||
        isHovered ||
        (isRelated && globalScale >= display.labelThreshold);
  const dimmed = highlight.nodes.size > 0 && !isRelated;

  ctx.save();
  ctx.globalAlpha = dimmed ? 0.16 : node.kind === "posting" ? 0.7 : 0.96;

  if (isSelected || isHovered) {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, radius + 7, 0, Math.PI * 2);
    ctx.fillStyle = rgba(node.color, 0.16);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, radius + 3, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(node.color, 0.82);
    ctx.lineWidth = Math.max(0.7, 1.3 / globalScale);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(node.x ?? 0, node.y ?? 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = node.kind === "posting" ? GRAPH_CANVAS_COLORS.postingNode : node.color;
  ctx.shadowBlur = node.kind === "posting" ? 3 : isSelected || isHovered ? 20 : 9;
  ctx.shadowColor = node.kind === "posting"
    ? GRAPH_CANVAS_COLORS.postingShadow
    : rgba(node.color, 0.28);
  ctx.fill();

  if (node.kind === "skill") {
    ctx.beginPath();
    ctx.arc(node.x ?? 0, node.y ?? 0, Math.max(1.2, radius * 0.28), 0, Math.PI * 2);
    ctx.fillStyle = GRAPH_CANVAS_COLORS.nodeHighlight;
    ctx.shadowBlur = 0;
    ctx.fill();
  }

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
    )
    .d3ReheatSimulation();
}


function configureAnimation(
  graph: ForceGraphInstance,
  animate: boolean,
  reduceMotion: boolean,
) {
  if (reduceMotion) {
    graph
      .warmupTicks(80)
      .cooldownTicks(0)
      .cooldownTime(0)
      .autoPauseRedraw(true)
      .resumeAnimation();
    return;
  }

  if (animate) {
    graph
      .warmupTicks(10)
      .cooldownTicks(Infinity)
      .cooldownTime(Infinity)
      .d3AlphaDecay(0.012)
      .d3VelocityDecay(0.35)
      .autoPauseRedraw(false)
      .resumeAnimation()
      .d3ReheatSimulation();
    return;
  }

  graph
    .warmupTicks(30)
    .cooldownTicks(90)
    .cooldownTime(3200)
    .d3AlphaDecay(0.045)
    .d3VelocityDecay(0.46)
    .autoPauseRedraw(true)
    .resumeAnimation()
    .d3ReheatSimulation();
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
  graph.d3ReheatSimulation();
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
  const highlightRef = useRef<HighlightState>({
    nodeId: null,
    nodes: new Set(),
    links: new Set(),
  });
  const selectedIdRef = useRef<string | null>(selectedId);
  const reduceMotionRef = useRef(false);
  const touchInputRef = useRef(false);
  const initialViewReadyRef = useRef(false);
  const readyRef = useRef(false);
  const revealGraphRef = useRef<() => void>(() => undefined);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

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
        .showPointerCursor((object) => Boolean(object))
        .onNodeHover((node) => {
          const graph = graphRef.current;
          const highlight: HighlightState = {
            nodeId: node ? String(node.id) : null,
            nodes: new Set(),
            links: new Set(),
          };

          if (node && graph) {
            highlight.nodes.add(String(node.id));
            graph.graphData().links.forEach((link) => {
              const source = getNodeId(link.source);
              const target = getNodeId(link.target);
              if (source === node.id || target === node.id) {
                highlight.links.add(link.id);
                highlight.nodes.add(source);
                highlight.nodes.add(target);
              }
            });
          }

          highlightRef.current = highlight;
          graph?.d3ReheatSimulation();
        })
        .onNodeClick((node) => {
          if (node.kind === "skill") {
            onNodeSelect(String(node.id));
            if (typeof node.x === "number" && typeof node.y === "number") {
              graphRef.current
                ?.centerAt(node.x, node.y, 420)
                .zoom(touchInputRef.current ? 1.72 : 2.15, 420);
            }
            graphRef.current?.d3ReheatSimulation();
          }
        })
        .onNodeDrag((node) => {
          node.fx = node.x;
          node.fy = node.y;
          graphRef.current?.d3ReheatSimulation();
        })
        .onNodeDragEnd((node) => {
          node.fx = node.x;
          node.fy = node.y;
          graphRef.current?.d3ReheatSimulation();
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
        node.kind === "posting"
          ? `${node.evidence?.company_name ?? node.label} / ${node.evidence?.title ?? ""}`
          : `${node.label} / ${node.domain} / ${node.demandCount} postings`,
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
        const focused =
          highlightRef.current.links.size === 0 || highlightRef.current.links.has(link.id);
        const base = Math.max(0.18, link.value * display.linkThickness);
        return focused ? base : Math.max(0.05, base * 0.24);
      })
      .linkColor((link) => {
        const focused =
          highlightRef.current.links.size === 0 || highlightRef.current.links.has(link.id);
        if (!focused) {
          return GRAPH_CANVAS_COLORS.dimmedLink;
        }
        return link.kind === "evidence"
          ? GRAPH_CANVAS_COLORS.evidenceLink
          : GRAPH_CANVAS_COLORS.skillLink;
      })
      .linkDirectionalArrowLength((link) =>
        display.arrows && link.kind === "skill" ? Math.max(2, display.linkThickness * 3.4) : 0,
      )
      .linkDirectionalArrowColor(() => GRAPH_CANVAS_COLORS.skillLink)
      .linkDirectionalArrowRelPos(0.94)
      .linkCurvature((link) => (link.kind === "evidence" ? 0.08 : 0.02));

    configureAnimation(graph, display.animate, reduceMotionRef.current);
    graph.d3ReheatSimulation();
  }, [display, selectedId, mounted]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }
    configureForces(graph, forces);
    configureAnimation(graph, display.animate, reduceMotionRef.current);
  }, [forces, display.animate, mounted]);

  useEffect(() => {
    const graph = graphRef.current;
    if (!graph || data.nodes.length === 0) {
      return;
    }
    configureAnimation(graph, display.animate, reduceMotionRef.current);
    if (!display.animate && reheatKey === 0) {
      return;
    }
    if (reduceMotionRef.current) {
      graph.d3ReheatSimulation();
      return;
    }

    let frame = 0;
    let animationFrame = 0;
    const pulse = () => {
      nudgeGraph(graph, reheatKey + frame);
      frame += 1;
      if (frame < 18) {
        animationFrame = window.requestAnimationFrame(pulse);
      }
    };
    pulse();
    return () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [reheatKey, data.nodes.length, display.animate, mounted]);

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
