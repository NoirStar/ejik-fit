"use client";

import { useEffect, useRef, useState } from "react";

import { domainColor } from "@/lib/skill-graph";
import type { SkillGraphResponse } from "@/lib/types";


type SkillGraphSigmaCanvasProps = {
  graph: SkillGraphResponse;
  onNodeSelect: (nodeId: string) => void;
  onReadyChange?: (ready: boolean) => void;
};


function canUseWebGL() {
  if (typeof window === "undefined") {
    return false;
  }
  return "WebGL2RenderingContext" in window || "WebGLRenderingContext" in window;
}


function hashString(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}


function obsidianNodeSize(demandCount: number, seed: boolean): number {
  if (seed) {
    return 7.6;
  }
  return Math.max(2.2, Math.min(6.8, 2.2 + Math.sqrt(Math.max(0, demandCount)) * 0.86));
}


function obsidianEdgeSize(score: number): number {
  return Math.max(0.12, Math.min(0.72, 0.16 + Math.max(0, score) * 0.64));
}


export function SkillGraphSigmaCanvas({
  graph,
  onNodeSelect,
  onReadyChange,
}: SkillGraphSigmaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderer: { kill: () => void } | null = null;
    let animationFrame: number | null = null;

    setReady(false);
    onReadyChange?.(false);

    async function mountSigma() {
      if (!containerRef.current || !canUseWebGL() || graph.nodes.length === 0) {
        return;
      }

      const [{ default: Graph }, { default: Sigma }, forceAtlas2] =
        await Promise.all([
          import("graphology"),
          import("sigma"),
          import("graphology-layout-forceatlas2"),
        ]);

      if (cancelled || !containerRef.current) {
        return;
      }

      const sigmaGraph = new Graph();
      const nodePositions = new Map<string, { x: number; y: number }>();
      const domainAngles = new Map<string, number>();
      const collectDomainAngle = (domain: string | undefined) => {
        const key = domain ?? "unknown";
        if (!domainAngles.has(key)) {
          const angle = (hashString(key) % 6283) / 1000;
          domainAngles.set(key, angle);
        }
        return domainAngles.get(key) ?? 0;
      };

      graph.nodes.forEach((node, index) => {
        const domain = node.domains[0] ?? "unknown";
        const clusterAngle = collectDomainAngle(domain);
        const jitter = ((hashString(`${node.id}:${index}`) % 360) / 360) * Math.PI * 2;
        const radius = node.seed ? 0 : 2.4 + (hashString(node.id) % 90) / 45;
        const x = node.seed ? 0 : Math.cos(clusterAngle) * radius + Math.cos(jitter) * 0.7;
        const y = node.seed ? 0 : Math.sin(clusterAngle) * radius + Math.sin(jitter) * 0.7;
        nodePositions.set(node.id, { x, y });
        sigmaGraph.addNode(node.id, {
          label: node.label,
          x,
          y,
          size: obsidianNodeSize(node.demand_count, node.seed),
          color: domainColor(node.domains[0]),
          nodeKind: "skill",
          forceLabel: node.seed,
          zIndex: node.seed ? 3 : 2,
        });
      });

      graph.edges.forEach((edge) => {
        if (!sigmaGraph.hasNode(edge.source) || !sigmaGraph.hasNode(edge.target)) {
          return;
        }
        sigmaGraph.addUndirectedEdgeWithKey(edge.id, edge.source, edge.target, {
          size: obsidianEdgeSize(edge.score),
          color: "rgba(151, 161, 184, 0.28)",
          zIndex: 1,
        });
      });

      graph.evidence.slice(0, 140).forEach((item, index) => {
        const linkedSkills = item.skills.filter((skill) => sigmaGraph.hasNode(skill));
        if (linkedSkills.length === 0) {
          return;
        }

        const center = linkedSkills.reduce(
          (acc, skill) => {
            const position = nodePositions.get(skill);
            return position
              ? { x: acc.x + position.x, y: acc.y + position.y }
              : acc;
          },
          { x: 0, y: 0 },
        );
        const divisor = Math.max(1, linkedSkills.length);
        const angle = ((hashString(item.posting_id) % 360) / 360) * Math.PI * 2;
        const radius = 0.52 + (index % 9) * 0.045;
        const jobNodeId = `job:${item.posting_id}`;
        sigmaGraph.addNode(jobNodeId, {
          label: item.company_name,
          x: center.x / divisor + Math.cos(angle) * radius,
          y: center.y / divisor + Math.sin(angle) * radius,
          size: 1.35 + Math.min(1.4, linkedSkills.length * 0.18),
          color: "rgba(214, 218, 229, 0.62)",
          nodeKind: "posting",
          zIndex: 1,
        });

        linkedSkills.slice(0, 8).forEach((skill) => {
          const edgeId = `${jobNodeId}:${skill}`;
          if (sigmaGraph.hasEdge(edgeId)) {
            return;
          }
          sigmaGraph.addUndirectedEdgeWithKey(edgeId, jobNodeId, skill, {
            size: 0.12,
            color: "rgba(142, 149, 166, 0.16)",
            zIndex: 0,
          });
        });
      });

      const layoutSettings = {
        ...forceAtlas2.default.inferSettings(sigmaGraph),
        adjustSizes: true,
        barnesHutOptimize: sigmaGraph.order > 90,
        gravity: 0.035,
        scalingRatio: 42,
        slowDown: 5,
      };

      forceAtlas2.default.assign(sigmaGraph, {
        iterations: 70,
        settings: layoutSettings,
      });

      let hoveredNode: string | null = null;
      const connectedNodes = new Set<string>();
      const refreshConnectedNodes = (node: string | null) => {
        connectedNodes.clear();
        if (!node) {
          return;
        }
        connectedNodes.add(node);
        sigmaGraph.forEachNeighbor(node, (neighbor: string) => connectedNodes.add(neighbor));
      };

      const sigmaRenderer = new Sigma(sigmaGraph, containerRef.current, {
        allowInvalidContainer: true,
        autoCenter: true,
        autoRescale: true,
        defaultEdgeColor: "rgba(151, 161, 184, 0.28)",
        defaultEdgeType: "line",
        defaultNodeColor: "rgba(232, 236, 247, 0.72)",
        enableCameraRotation: false,
        hideEdgesOnMove: true,
        hideLabelsOnMove: true,
        itemSizesReference: "screen",
        labelColor: { color: "#eef4ff" },
        labelDensity: 0.08,
        labelFont: "Geist, Arial, sans-serif",
        labelRenderedSizeThreshold: 9.5,
        labelSize: 11,
        labelWeight: "760",
        maxCameraRatio: 8,
        minCameraRatio: 0.08,
        minEdgeThickness: 0.18,
        nodeReducer: (node: string, data: Record<string, unknown>) => {
          const isFocused = hoveredNode === node;
          const isConnected = hoveredNode ? connectedNodes.has(node) : true;
          return {
            ...data,
            color: isConnected
              ? (data.color as string)
              : "rgba(96, 101, 116, 0.26)",
            forceLabel: Boolean(data.forceLabel) || isFocused,
            highlighted: isFocused,
            size: isFocused
              ? Number(data.size ?? 2) * 1.85
              : Number(data.size ?? 2),
            zIndex: isFocused ? 5 : Number(data.zIndex ?? 1),
          };
        },
        edgeReducer: (edge: string, data: Record<string, unknown>) => {
          if (!hoveredNode) {
            return data;
          }
          const [source, target] = sigmaGraph.extremities(edge);
          const visible = source === hoveredNode || target === hoveredNode;
          return {
            ...data,
            color: visible
              ? "rgba(224, 231, 245, 0.48)"
              : "rgba(87, 92, 106, 0.06)",
            size: visible ? Math.max(0.3, Number(data.size ?? 0.12) * 1.55) : 0.08,
          };
        },
        renderEdgeLabels: false,
        renderLabels: true,
        stagePadding: 36,
        zIndex: true,
      });
      sigmaRenderer.on("clickNode", ({ node }: { node: string }) => {
        if (sigmaGraph.getNodeAttribute(node, "nodeKind") === "skill") {
          onNodeSelect(node);
        }
      });
      sigmaRenderer.on("enterNode", ({ node }: { node: string }) => {
        hoveredNode = node;
        refreshConnectedNodes(node);
        sigmaRenderer.refresh();
      });
      sigmaRenderer.on("leaveNode", () => {
        hoveredNode = null;
        refreshConnectedNodes(null);
        sigmaRenderer.refresh();
      });
      renderer = sigmaRenderer;
      setReady(true);
      onReadyChange?.(true);

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (!reduceMotion) {
        let frame = 0;
        const tick = () => {
          if (cancelled || frame > 90) {
            return;
          }
          frame += 1;
          forceAtlas2.default.assign(sigmaGraph, {
            iterations: 1,
            settings: layoutSettings,
          });
          sigmaRenderer.refresh();
          animationFrame = window.requestAnimationFrame(tick);
        };
        animationFrame = window.requestAnimationFrame(tick);
      }
    }

    mountSigma().catch(() => {
      if (!cancelled) {
        setReady(false);
      }
    });

    return () => {
      cancelled = true;
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      renderer?.kill();
      onReadyChange?.(false);
    };
  }, [graph, onNodeSelect, onReadyChange]);

  return (
    <div
      ref={containerRef}
      className={`sigma-canvas ${ready ? "sigma-canvas--ready" : ""}`}
      aria-hidden="true"
    />
  );
}
