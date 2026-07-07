import { domainColor } from "./skill-graph";
import type {
  SkillGraphViewData,
  SkillGraphViewDomain,
  SkillGraphViewLink,
  SkillGraphViewNode,
} from "./skill-graph-view";


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
  links.push({
    id,
    source,
    target,
    kind: "skill",
    score,
    value: Math.max(0.4, Math.min(4.5, 0.4 + score * 4)),
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
        val: hub ? 12 : 3.2 + Math.sqrt(demandCount) * 0.72,
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
