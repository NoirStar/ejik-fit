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
    expect(skillGraphNodePaint({ owned: false, recommended: false }, false)).toEqual({
      fill: GRAPH_CANVAS_COLORS.neutralNode,
      ring: null,
    });
    expect(skillGraphNodePaint({ owned: true, recommended: false }, false)).toEqual({
      fill: GRAPH_CANVAS_COLORS.neutralNode,
      ring: GRAPH_CANVAS_COLORS.ownedRing,
    });
    expect(skillGraphNodePaint({ owned: false, recommended: true }, false)).toEqual({
      fill: GRAPH_CANVAS_COLORS.neutralNode,
      ring: GRAPH_CANVAS_COLORS.recommendedRing,
    });
    expect(skillGraphNodePaint({ owned: true, recommended: true }, true)).toEqual({
      fill: GRAPH_CANVAS_COLORS.selectedNode,
      ring: GRAPH_CANVAS_COLORS.ownedRing,
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
    expect(Math.max(...values)).toBeLessThanOrEqual(1.6);
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
    expect(SKILL_GRAPH_LABEL_FONT_FAMILY).toContain("Pretendard");

    const source = readFileSync(
      resolve(process.cwd(), "src/components/skill-graph-force-canvas.tsx"),
      "utf8",
    );
    expect(source).not.toContain("rgba(86, 56, 198");
    expect(source).not.toContain("var(--font-geist)");
  });
});
