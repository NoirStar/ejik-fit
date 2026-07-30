import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  SKILL_GRAPH_LABEL_FONT_FAMILY,
  skillGraphLinkColor,
  skillGraphLinkWidth,
  skillGraphNodePaint,
} from "./skill-graph-canvas-style";
import { GRAPH_CANVAS_COLORS } from "@/styles/design-tokens";


describe("skill graph canvas styling", () => {
  it("uses explicit visual roles for resting, selected, owned, and recommended nodes", () => {
    const backend = "#27ae60";
    expect(skillGraphNodePaint({ color: backend, owned: false, recommendationRank: null }, false)).toEqual({
      fill: backend,
      ring: null,
      recommendationMarker: null,
    });
    expect(skillGraphNodePaint({ color: backend, owned: true, recommendationRank: null }, false)).toEqual({
      fill: backend,
      ring: GRAPH_CANVAS_COLORS.ownedRing,
      recommendationMarker: null,
    });
    expect(skillGraphNodePaint({ color: backend, owned: false, recommendationRank: 2 }, false)).toEqual({
      fill: backend,
      ring: null,
      recommendationMarker: GRAPH_CANVAS_COLORS.recommendedRing,
    });
    expect(skillGraphNodePaint({ color: backend, owned: true, recommendationRank: 1 }, true)).toEqual({
      fill: GRAPH_CANVAS_COLORS.selectedNode,
      ring: GRAPH_CANVAS_COLORS.ownedRing,
      recommendationMarker: GRAPH_CANVAS_COLORS.recommendedRing,
    });
  });

  it("keeps every relationship line thin, including focused relationships", () => {
    const values = [
      skillGraphLinkWidth(0, 0.1, false, 0),
      skillGraphLinkWidth(0.6, 0.76, true, 0),
      skillGraphLinkWidth(1, 1, true, 0),
      skillGraphLinkWidth(99, 99, true, 99),
    ];

    expect(Math.min(...values)).toBeGreaterThanOrEqual(0.6);
    expect(Math.max(...values)).toBeLessThanOrEqual(1.35);
  });

  it("uses token-backed line colors and the product font", () => {
    expect(skillGraphLinkColor(0.1, false, false)).toBe(
      GRAPH_CANVAS_COLORS.dimmedLink,
    );
    expect(skillGraphLinkColor(0.1, true, false)).not.toBe(
      GRAPH_CANVAS_COLORS.dimmedLink,
    );
    expect(skillGraphLinkColor(0, true, false)).toBe(
      GRAPH_CANVAS_COLORS.restingLink,
    );
    expect(skillGraphLinkColor(1, true, true)).toBe(
      GRAPH_CANVAS_COLORS.focusedLink,
    );
    expect(skillGraphLinkColor(1, true, false, 0)).toBe(
      "rgba(86, 56, 198, 0)",
    );
    expect(skillGraphLinkColor(1, true, false, 0.5)).toBe(
      "rgba(86, 56, 198, 0.23)",
    );
    expect(SKILL_GRAPH_LABEL_FONT_FAMILY).toContain("Pretendard");

    const source = readFileSync(
      resolve(process.cwd(), "src/components/skill-graph-force-canvas.tsx"),
      "utf8",
    );
    expect(source).not.toContain("rgba(86, 56, 198");
    expect(source).not.toContain("var(--font-geist)");
  });

  it("keeps representative labels readable in the fitted market overview", () => {
    const canvasSource = readFileSync(
      resolve(process.cwd(), "src/components/skill-graph-force-canvas.tsx"),
      "utf8",
    );
    const experienceSource = readFileSync(
      resolve(process.cwd(), "src/components/skill-graph-experience.tsx"),
      "utf8",
    );

    expect(canvasSource).toContain("const screenFontSize");
    expect(canvasSource).toContain("fontSize = screenFontSize / safeScale");
    expect(canvasSource).toContain("? 14 : node.seed ? 13 : 12");
    expect(canvasSource.match(/touchInputRef\.current \? 32 : 92/g))
      .toHaveLength(2);
    expect(experienceSource).toContain("labelThreshold: 0.18");
  });
});
