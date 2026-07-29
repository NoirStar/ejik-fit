import { describe, expect, it } from "vitest";

import type { SkillGraphViewLink, SkillGraphViewNode } from "./skill-graph-view";
import { findStrongestSkillGraphPath } from "./skill-graph-path";


function node(id: string): SkillGraphViewNode {
  return {
    id,
    label: id,
    kind: "skill",
    category: "test",
    domain: "test",
    domains: ["test"],
    color: "#777",
    val: 6,
    demandCount: 10,
    owned: false,
    recommended: false,
    recommendationRank: null,
    seed: false,
  };
}


function link(
  id: string,
  source: string,
  target: string,
  score: number,
  cooccurrenceCount: number,
): SkillGraphViewLink {
  return {
    id,
    source,
    target,
    kind: "skill",
    score,
    cooccurrenceCount,
    value: 1,
  };
}


describe("findStrongestSkillGraphPath", () => {
  it("returns a strong direct market connection", () => {
    const result = findStrongestSkillGraphPath({
      nodes: [node("C++"), node("ROS2")],
      links: [link("cpp-ros", "C++", "ROS2", 0.92, 31)],
      sourceIds: ["C++"],
      targetId: "ROS2",
    });

    expect(result).toMatchObject({
      nodeIds: ["C++", "ROS2"],
      linkIds: ["cpp-ros"],
      sourceId: "C++",
      targetId: "ROS2",
      hopCount: 1,
      weakestCooccurrenceCount: 31,
    });
  });

  it("prefers a short strong bridge over a weak direct coincidence", () => {
    const result = findStrongestSkillGraphPath({
      nodes: [node("C++"), node("Linux"), node("Docker")],
      links: [
        link("cpp-linux", "C++", "Linux", 0.95, 40),
        link("linux-docker", "Linux", "Docker", 0.92, 31),
        link("cpp-docker", "C++", "Docker", 0.08, 1),
      ],
      sourceIds: ["C++"],
      targetId: "Docker",
    });

    expect(result?.nodeIds).toEqual(["C++", "Linux", "Docker"]);
    expect(result?.linkIds).toEqual(["cpp-linux", "linux-docker"]);
    expect(result?.averageScore).toBeCloseTo(0.935);
  });

  it("starts from the owned skill with the strongest route", () => {
    const result = findStrongestSkillGraphPath({
      nodes: [node("Java"), node("C++"), node("Linux"), node("Docker")],
      links: [
        link("java-docker", "Java", "Docker", 0.12, 2),
        link("cpp-linux", "C++", "Linux", 0.96, 44),
        link("linux-docker", "Linux", "Docker", 0.94, 35),
      ],
      sourceIds: ["Java", "C++"],
      targetId: "Docker",
    });

    expect(result?.sourceId).toBe("C++");
    expect(result?.nodeIds).toEqual(["C++", "Linux", "Docker"]);
  });

  it("does not cross more relationships than the configured ceiling", () => {
    const nodes = ["A", "B", "C", "D", "E", "F"].map(node);
    const links = [
      link("ab", "A", "B", 1, 20),
      link("bc", "B", "C", 1, 20),
      link("cd", "C", "D", 1, 20),
      link("de", "D", "E", 1, 20),
      link("ef", "E", "F", 1, 20),
    ];

    expect(findStrongestSkillGraphPath({
      nodes,
      links,
      sourceIds: ["A"],
      targetId: "F",
      maxHops: 4,
    })).toBeNull();
  });

  it("returns an empty route for an owned target and null when disconnected", () => {
    const nodes = [node("C++"), node("ROS2"), node("Kotlin")];
    const links = [link("cpp-ros", "C++", "ROS2", 0.9, 20)];

    expect(findStrongestSkillGraphPath({
      nodes,
      links,
      sourceIds: ["C++"],
      targetId: "C++",
    })).toMatchObject({
      nodeIds: ["C++"],
      linkIds: [],
      hopCount: 0,
    });
    expect(findStrongestSkillGraphPath({
      nodes,
      links,
      sourceIds: ["C++"],
      targetId: "Kotlin",
    })).toBeNull();
  });
});
