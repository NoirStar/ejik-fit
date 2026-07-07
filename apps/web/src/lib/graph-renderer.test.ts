import { describe, expect, it } from "vitest";

import {
  FORCE_CANVAS_RENDERER,
  LARGE_GRAPH_RENDERER_THRESHOLD,
  selectGraphRenderer,
  shouldUseLargeGraphRenderer,
} from "./graph-renderer";
import { buildMarketGraphArtifact } from "./market-graph-artifact";
import type { SkillGraphViewData } from "./skill-graph-view";


const view: SkillGraphViewData = {
  nodes: [
    {
      id: "C++",
      label: "C++",
      kind: "skill",
      category: "language",
      domain: "embedded",
      domains: ["embedded"],
      color: "#2f80ed",
      val: 12,
      demandCount: 12,
      owned: true,
      seed: true,
    },
    {
      id: "ROS2",
      label: "ROS2",
      kind: "skill",
      category: "framework",
      domain: "robotics",
      domains: ["robotics"],
      color: "#f2994a",
      val: 8,
      demandCount: 7,
      owned: false,
      seed: false,
    },
  ],
  links: [
    {
      id: "C++:ROS2",
      source: "C++",
      target: "ROS2",
      kind: "skill",
      score: 0.8,
      value: 3.6,
    },
  ],
  domains: [],
  stats: {
    skillCount: 2,
    evidenceCount: 0,
    linkCount: 1,
  },
};


describe("graph renderer contracts", () => {
  it("keeps the current canvas renderer marked as an MVP-scale adapter", () => {
    expect(FORCE_CANVAS_RENDERER).toMatchObject({
      id: "force-canvas",
      engine: "canvas-2d",
      supportsLargeGraph: false,
      supportsLiveForces: true,
      maxRecommendedNodes: LARGE_GRAPH_RENDERER_THRESHOLD,
    });
  });

  it("flags the large graph boundary before swapping to a WebGL renderer", () => {
    expect(shouldUseLargeGraphRenderer(LARGE_GRAPH_RENDERER_THRESHOLD - 1)).toBe(
      false,
    );
    expect(shouldUseLargeGraphRenderer(LARGE_GRAPH_RENDERER_THRESHOLD)).toBe(true);

    const selection = selectGraphRenderer(LARGE_GRAPH_RENDERER_THRESHOLD);
    expect(selection).toMatchObject({
      adapter: FORCE_CANVAS_RENDERER,
      needsLargeGraphRenderer: true,
      reason: "large-renderer-needed",
    });
  });

  it("uses a large-capable adapter when one is registered", () => {
    const webglAdapter = {
      id: "sigma-webgl",
      label: "Sigma WebGL",
      engine: "webgl" as const,
      maxRecommendedNodes: 100_000,
      supportsLargeGraph: true,
      supportsLiveForces: false,
    };

    expect(
      selectGraphRenderer(20_000, [FORCE_CANVAS_RENDERER, webglAdapter]),
    ).toMatchObject({
      adapter: webglAdapter,
      needsLargeGraphRenderer: true,
      reason: "large-renderer-available",
    });
  });

  it("converts the current view model into a renderer artifact shape", () => {
    const artifact = buildMarketGraphArtifact(view, {
      generatedAt: "2026-07-07T00:00:00.000Z",
      positions: {
        "C++": { x: 10, y: 20 },
        ROS2: { x: 30, y: 40 },
      },
    });

    expect(artifact).toMatchObject({
      version: 1,
      generatedAt: "2026-07-07T00:00:00.000Z",
      meta: {
        source: "skill-graph-view",
        nodeCount: 2,
        edgeCount: 1,
        skillCount: 2,
        evidenceCount: 0,
        layout: "precomputed",
      },
    });
    expect(artifact.nodes[0]).toMatchObject({
      id: "C++",
      x: 10,
      y: 20,
      degree: 1,
      demandCount: 12,
      owned: true,
    });
    expect(artifact.edges).toEqual([
      {
        source: "C++",
        target: "ROS2",
        weight: 3.6,
        kind: "cooccurrence",
      },
    ]);
  });
});
