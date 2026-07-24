import { domainColor } from "./skill-graph";
import type {
  SkillGraphViewData,
  SkillGraphViewDomain,
  SkillGraphViewLink,
  SkillGraphViewNode,
} from "./skill-graph-view";
import type { SkillGraphResponse } from "./types";


export const LARGE_GRAPH_FIXTURE_SIZES = [5_000, 20_000, 50_000] as const;


export type LargeGraphFixtureSize = (typeof LARGE_GRAPH_FIXTURE_SIZES)[number];


export type LargeGraphFixtureOptions = {
  nodeCount: number;
  communitySize?: number;
};


const DOMAINS = [
  "backend",
  "cloud",
  "devops",
  "embedded",
  "robotics",
  "ai",
  "security",
  "game",
  "graphics",
  "data",
] as const;


function domainFor(index: number) {
  return DOMAINS[index % DOMAINS.length];
}


function labelFor(index: number) {
  const domain = domainFor(index);
  return `${domain}:${index.toString().padStart(5, "0")}`;
}


function addLink(
  links: SkillGraphViewLink[],
  id: string,
  source: string,
  target: string,
  score: number,
) {
  if (source === target) {
    return;
  }
  const cooccurrenceCount = Math.max(1, Math.round(score * 10));
  links.push({
    id,
    source,
    target,
    kind: "skill",
    cooccurrenceCount,
    score,
    value: Math.max(0.55, Math.min(4.5, 0.55 + Math.sqrt(cooccurrenceCount) * 0.72)),
  });
}


function buildDomains(nodeCount: number): SkillGraphViewDomain[] {
  const counts = new Map<string, number>();
  for (let index = 0; index < nodeCount; index += 1) {
    const domain = domainFor(index);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }

  return [...counts.entries()].map(([domain, count]) => ({
    domain,
    label: domain.replace(/_/g, " "),
    count,
    color: domainColor(domain),
    enabled: true,
  }));
}


export function buildDenseSkillGraphResponseFixture({
  nodeCount,
}: Pick<LargeGraphFixtureOptions, "nodeCount">): SkillGraphResponse {
  const safeNodeCount = Math.max(0, Math.floor(nodeCount));
  const nodes = Array.from({ length: safeNodeCount }, (_, index) => {
    const domain = domainFor(index);
    const demandCount = Math.max(1, safeNodeCount - index);
    return {
      id: `skill:${index}`,
      label: labelFor(index),
      category: index % 2 === 0 ? "language" : "platform",
      kind: index % 2 === 0 ? "language" : "platform",
      domains: [domain],
      demand_count: demandCount,
      required_count: Math.max(0, demandCount - 2),
      preferred_count: Math.min(2, demandCount),
      unspecified_count: 0,
      owned: index < 3,
      seed: index === 0,
    };
  });
  const edges = nodes.flatMap((left, leftIndex) =>
    nodes.slice(leftIndex + 1).map((right, offset) => {
      const distance = offset + 1;
      const score = Math.max(0.05, 1 - distance / Math.max(1, safeNodeCount));
      return {
        id: `${left.id}::${right.id}`,
        source: left.id,
        target: right.id,
        score,
        cooccurrence_count: Math.max(1, safeNodeCount - distance),
        required_pair_count: Math.max(0, safeNodeCount - distance - 2),
        supporting_posting_ids: [`posting:${leftIndex}:${leftIndex + distance}`],
      };
    }),
  );

  return {
    seed: nodes[0]?.id ?? null,
    nodes,
    edges,
    evidence: [],
    meta: { limit: safeNodeCount, min_confidence: 0.8 },
  };
}


export function buildLargeSkillGraphViewFixture({
  nodeCount,
  communitySize = 80,
}: LargeGraphFixtureOptions): SkillGraphViewData {
  const safeNodeCount = Math.max(0, Math.floor(nodeCount));
  const safeCommunitySize = Math.max(2, Math.floor(communitySize));

  const nodes: SkillGraphViewNode[] = Array.from(
    { length: safeNodeCount },
    (_, index) => {
      const domain = domainFor(index);
      const demandCount = 1 + ((index * 17) % 96);
      const hub = index % safeCommunitySize === 0;
      return {
        id: `skill:${index}`,
        label: hub ? `${domain} hub ${index}` : labelFor(index),
        kind: "skill",
        category: hub ? "domain-hub" : "technology",
        domain,
        domains: [domain],
        color: domainColor(domain),
        val: Math.min(10, 3.2 + Math.sqrt(demandCount) * 1.15),
        demandCount,
        owned: index < 8,
        seed: index === 0,
      };
    },
  );

  const links: SkillGraphViewLink[] = [];
  for (let index = 0; index < safeNodeCount; index += 1) {
    const source = `skill:${index}`;
    const next = `skill:${(index + 1) % safeNodeCount}`;
    const communityHub = `skill:${Math.floor(index / safeCommunitySize) * safeCommunitySize}`;
    const bridge = `skill:${(index * 31 + 17) % safeNodeCount}`;

    addLink(links, `ring:${index}`, source, next, 0.32);
    addLink(links, `community:${index}`, source, communityHub, 0.72);
    if (index % 3 === 0) {
      addLink(links, `bridge:${index}`, source, bridge, 0.48);
    }
  }

  return {
    nodes,
    links,
    domains: buildDomains(safeNodeCount),
    stats: {
      skillCount: safeNodeCount,
      evidenceCount: 0,
      linkCount: links.length,
    },
  };
}
