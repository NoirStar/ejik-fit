import {
  GRAPH_CANVAS_COLORS,
  graphCanvasSkillLinkColor,
} from "@/styles/design-tokens";


export const SKILL_GRAPH_LABEL_FONT_FAMILY =
  '"Pretendard Variable", Pretendard, sans-serif';


type SkillGraphNodeState = {
  owned: boolean;
  recommended: boolean;
};


function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}


export function skillGraphNodePaint(
  node: SkillGraphNodeState,
  selected: boolean,
) {
  return {
    fill: selected
      ? GRAPH_CANVAS_COLORS.selectedNode
      : GRAPH_CANVAS_COLORS.neutralNode,
    ring: node.owned
      ? GRAPH_CANVAS_COLORS.ownedRing
      : node.recommended
        ? GRAPH_CANVAS_COLORS.recommendedRing
        : null,
  };
}


export function skillGraphLinkWidth(
  value: number,
  thickness: number,
  focused: boolean,
  relationRatio: number,
) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeThickness = Number.isFinite(thickness) ? thickness : 0;
  const restingWidth = clamp(safeValue * safeThickness, 0.6, 1);
  if (!focused) {
    return 0.6;
  }
  return clamp(restingWidth + clamp(relationRatio, 0, 1) * 0.6, 0.6, 1.6);
}


export function skillGraphLinkColor(
  score: number,
  focused: boolean,
  emphasized: boolean,
) {
  if (!focused) {
    return GRAPH_CANVAS_COLORS.dimmedLink;
  }
  const safeScore = Number.isFinite(score) ? clamp(score, 0, 1) : 0;
  const alpha = clamp(0.18 + safeScore * 0.28 + (emphasized ? 0.12 : 0), 0.18, 0.58);
  return graphCanvasSkillLinkColor(alpha);
}
