import { describe, expect, it } from "vitest";

import { createGraphLodState } from "./graph-lod";
import type { MarketGraphArtifact } from "./market-graph-artifact";


const artifact: MarketGraphArtifact = {
  version: 1,
  generatedAt: "2026-07-07T00:00:00.000Z",
  nodes: [
    {
      id: "C++",
      label: "C++",
      kind: "skill",
      x: 0,
      y: 0,
      size: 12,
      color: "#2f80ed",
      degree: 3,
      demandCount: 40,
      owned: true,
    },
    {
      id: "ROS2",
      label: "ROS2",
      kind: "skill",
      x: 1,
      y: 1,
      size: 9,
      color: "#f2994a",
      degree: 2,
      demandCount: 24,
    },
    {
      id: "Linux",
      label: "Linux",
      kind: "skill",
      x: 2,
      y: 2,
      size: 8,
      color: "#23c979",
      degree: 2,
      demandCount: 30,
    },
    {
      id: "TensorFlow",
      label: "TensorFlow",
      kind: "skill",
      x: 3,
      y: 3,
      size: 4,
      color: "#7c5cff",
      degree: 1,
      demandCount: 7,
    },
  ],
  edges: [
    { source: "C++", target: "ROS2", weight: 2.5, kind: "cooccurrence" },
    { source: "C++", target: "Linux", weight: 2, kind: "cooccurrence" },
    { source: "ROS2", target: "Linux", weight: 1.5, kind: "cooccurrence" },
    { source: "TensorFlow", target: "Linux", weight: 1, kind: "cooccurrence" },
  ],
  meta: {
    source: "skill-graph-view",
    nodeCount: 4,
    edgeCount: 4,
    skillCount: 4,
    evidenceCount: 0,
    layout: "precomputed",
  },
};


describe("createGraphLodState", () => {
  it("hides labels and edges at low zoom", () => {
    expect(createGraphLodState(artifact, { zoom: 0.4 })).toEqual({
      mode: "node-only",
      labelNodeIds: [],
      visibleEdgeIndexes: [],
      selectedNeighborhoodIds: [],
    });
  });

  it("shows only top hub labels at medium zoom", () => {
    const lod = createGraphLodState(artifact, {
      zoom: 1,
      hubLabelLimit: 2,
    });

    expect(lod).toMatchObject({
      mode: "hub-labels",
      visibleEdgeIndexes: [],
      selectedNeighborhoodIds: [],
    });
    expect(lod.labelNodeIds).toEqual(["C++", "Linux"]);
  });

  it("shows selected neighborhood labels and edges at high zoom", () => {
    const lod = createGraphLodState(artifact, {
      zoom: 2,
      selectedId: "ROS2",
      neighborhoodDepth: 1,
    });

    expect(lod.mode).toBe("neighborhood-detail");
    expect(lod.labelNodeIds).toEqual(["C++", "Linux", "ROS2"]);
    expect(lod.selectedNeighborhoodIds).toEqual(["C++", "Linux", "ROS2"]);
    expect(lod.visibleEdgeIndexes).toEqual([0, 1, 2]);
  });
});
