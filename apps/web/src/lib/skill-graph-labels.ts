import type { SkillGraphViewNode } from "./skill-graph-view";


function compareLabelPriority(
  left: SkillGraphViewNode,
  right: SkillGraphViewNode,
) {
  return (
    right.demandCount - left.demandCount ||
    left.id.localeCompare(right.id, "en")
  );
}


export function selectSkillGraphLabelIds(
  nodes: readonly SkillGraphViewNode[],
  limit: number,
) {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (safeLimit === 0) return new Set<string>();

  const sorted = [...nodes].sort(compareLabelPriority);
  const representativeByDomain = new Map<string, SkillGraphViewNode>();
  sorted.forEach((node) => {
    if (!representativeByDomain.has(node.domain)) {
      representativeByDomain.set(node.domain, node);
    }
  });

  const selected = new Set<string>();
  [...representativeByDomain.values()]
    .sort(compareLabelPriority)
    .slice(0, safeLimit)
    .forEach((node) => selected.add(node.id));

  for (const node of sorted) {
    if (selected.size >= safeLimit) break;
    selected.add(node.id);
  }
  return selected;
}
