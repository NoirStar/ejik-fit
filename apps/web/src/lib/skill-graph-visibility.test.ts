import { describe, expect, it } from "vitest";

import type { SkillGraphViewLink } from "./skill-graph-view";
import {
  buildVisibleSkillGraphLinkIds,
  shouldRenderSkillGraphLink,
  skillGraphLabelLimit,
} from "./skill-graph-visibility";


function links(count: number): SkillGraphViewLink[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `link-${String(index).padStart(2, "0")}`,
    source: `node-${index}`,
    target: `node-${index + 1}`,
    kind: "skill" as const,
    cooccurrenceCount: count - index,
    score: Math.max(0, 1 - index / count),
    value: 1,
  }));
}


describe("skill graph visibility", () => {
  it("uses stable relationship budgets for the desktop atlas", () => {
    const atlasLinks = links(84);

    expect(buildVisibleSkillGraphLinkIds(atlasLinks, 48, "core").size).toBe(58);
    expect(buildVisibleSkillGraphLinkIds(atlasLinks, 48, "balanced").size).toBe(71);
    expect(buildVisibleSkillGraphLinkIds(atlasLinks, 48, "detailed").size).toBe(84);
  });

  it("keeps the ordered backbone before hiding contextual links", () => {
    const graphLinks = links(30);
    const visible = buildVisibleSkillGraphLinkIds(graphLinks, 26, "core");

    expect(visible.size).toBe(25);
    expect([...visible]).toEqual(graphLinks.slice(0, 25).map(({ id }) => id));
  });

  it("reveals a hidden relationship when interaction provides context", () => {
    const visible = new Set(["resting"]);
    const highlighted = new Set(["context"]);

    expect(shouldRenderSkillGraphLink("resting", visible, highlighted)).toBe(true);
    expect(shouldRenderSkillGraphLink("context", visible, highlighted)).toBe(true);
    expect(shouldRenderSkillGraphLink("hidden", visible, highlighted)).toBe(false);
    expect(shouldRenderSkillGraphLink("hidden", undefined, highlighted)).toBe(true);
  });

  it("increases label candidates without exceeding the visible nodes", () => {
    expect(skillGraphLabelLimit("key", 48)).toBe(14);
    expect(skillGraphLabelLimit("more", 48)).toBe(28);
    expect(skillGraphLabelLimit("key", 8)).toBe(8);
    expect(skillGraphLabelLimit("more", 18)).toBe(18);
  });
});
