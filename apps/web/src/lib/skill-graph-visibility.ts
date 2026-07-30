import type { SkillGraphViewLink } from "./skill-graph-view";


export type SkillGraphRelationshipDensity = "core" | "balanced" | "detailed";


export type SkillGraphLabelDensity = "key" | "more";


const DENSITY_RATIO: Record<SkillGraphRelationshipDensity, number> = {
  core: 0.68,
  balanced: 0.84,
  detailed: 1,
};


export function buildVisibleSkillGraphLinkIds(
  links: readonly SkillGraphViewLink[],
  nodeCount: number,
  density: SkillGraphRelationshipDensity,
) {
  const safeNodeCount = Number.isFinite(nodeCount)
    ? Math.max(0, Math.floor(nodeCount))
    : 0;
  const backboneCount = Math.min(
    links.length,
    Math.max(0, safeNodeCount - 1),
  );
  const visibleCount = Math.min(
    links.length,
    Math.max(
      backboneCount,
      Math.ceil(links.length * DENSITY_RATIO[density]),
    ),
  );
  return new Set(links.slice(0, visibleCount).map(({ id }) => id));
}


export function shouldRenderSkillGraphLink(
  linkId: string,
  visibleLinkIds: ReadonlySet<string> | undefined,
  contextualLinkIds: ReadonlySet<string>,
  contextualEndpointsVisible = true,
) {
  return visibleLinkIds === undefined ||
    visibleLinkIds.has(linkId) ||
    (contextualEndpointsVisible && contextualLinkIds.has(linkId));
}


export function skillGraphLabelLimit(
  density: SkillGraphLabelDensity,
  nodeCount: number,
) {
  const safeNodeCount = Number.isFinite(nodeCount)
    ? Math.max(0, Math.floor(nodeCount))
    : 0;
  return Math.min(safeNodeCount, density === "more" ? 28 : 14);
}
