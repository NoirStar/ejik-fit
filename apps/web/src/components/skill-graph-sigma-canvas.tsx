"use client";

import { useEffect, useRef, useState } from "react";

import { domainColor, edgeSize, nodeSize } from "@/lib/skill-graph";
import type { SkillGraphResponse } from "@/lib/types";


type SkillGraphSigmaCanvasProps = {
  graph: SkillGraphResponse;
  onNodeSelect: (nodeId: string) => void;
};


function canUseWebGL() {
  if (typeof window === "undefined") {
    return false;
  }
  return "WebGL2RenderingContext" in window || "WebGLRenderingContext" in window;
}


export function SkillGraphSigmaCanvas({
  graph,
  onNodeSelect,
}: SkillGraphSigmaCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderer: { kill: () => void } | null = null;

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
      graph.nodes.forEach((node, index) => {
        const angle = (index / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
        sigmaGraph.addNode(node.id, {
          label: node.label,
          x: node.seed ? 0 : Math.cos(angle),
          y: node.seed ? 0 : Math.sin(angle),
          size: nodeSize(node.demand_count),
          color: domainColor(node.domains[0]),
        });
      });

      graph.edges.forEach((edge) => {
        if (!sigmaGraph.hasNode(edge.source) || !sigmaGraph.hasNode(edge.target)) {
          return;
        }
        sigmaGraph.addUndirectedEdgeWithKey(edge.id, edge.source, edge.target, {
          size: edgeSize(edge.score),
          color: "#6f7d9a",
        });
      });

      forceAtlas2.default.assign(sigmaGraph, {
        iterations: 90,
        settings: {
          ...forceAtlas2.default.inferSettings(sigmaGraph),
          gravity: 0.12,
          scalingRatio: 18,
        },
      });

      const sigmaRenderer = new Sigma(sigmaGraph, containerRef.current, {
        allowInvalidContainer: true,
        defaultEdgeColor: "#6f7d9a",
        defaultEdgeType: "line",
        labelColor: { color: "#f4f7ff" },
        renderEdgeLabels: false,
      });
      sigmaRenderer.on("clickNode", ({ node }: { node: string }) => {
        onNodeSelect(node);
      });
      renderer = sigmaRenderer;
      setReady(true);
    }

    mountSigma().catch(() => {
      if (!cancelled) {
        setReady(false);
      }
    });

    return () => {
      cancelled = true;
      renderer?.kill();
    };
  }, [graph, onNodeSelect]);

  return (
    <div
      ref={containerRef}
      className={`sigma-canvas ${ready ? "sigma-canvas--ready" : ""}`}
      aria-hidden="true"
    />
  );
}
