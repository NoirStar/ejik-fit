const SKILL_GRAPH_MIN_ZOOM = 0.18;
const MOUSE_POINTER_RADIUS_PX = 12;
const TOUCH_POINTER_RADIUS_PX = 22;

export function skillGraphPointerRadius(
  nodeValue: number | undefined,
  globalScale: number,
  touchInput: boolean,
) {
  const safeScale =
    Number.isFinite(globalScale) && globalScale > 0
      ? Math.max(SKILL_GRAPH_MIN_ZOOM, globalScale)
      : SKILL_GRAPH_MIN_ZOOM;
  const minimumScreenRadius = touchInput
    ? TOUCH_POINTER_RADIUS_PX
    : MOUSE_POINTER_RADIUS_PX;
  const nodeRadius = Math.max(0, nodeValue ?? 4) + 7;

  return Math.max(nodeRadius, minimumScreenRadius / safeScale);
}
