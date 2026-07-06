import { domainColor } from "./skill-graph";
import type {
  SkillGraphEvidence,
  SkillGraphNode,
  SkillGraphResponse,
} from "./types";


export type SkillGraphViewMode = "global" | "local";


export type SkillGraphViewOptions = {
  enabledDomains?: string[];
  localDepth?: number;
  mode?: SkillGraphViewMode;
  query?: string;
  selectedId?: string | null;
  showEvidence?: boolean;
  showIsolated?: boolean;
};


export type SkillGraphViewNode = {
  id: string;
  label: string;
  kind: "skill" | "posting";
  category: string;
  domain: string;
  domains: string[];
  color: string;
  val: number;
  demandCount: number;
  owned: boolean;
  seed: boolean;
  evidence?: SkillGraphEvidence;
  skill?: SkillGraphNode;
};


export type SkillGraphViewLink = {
  id: string;
  source: string;
  target: string;
  kind: "skill" | "evidence";
  score: number;
  value: number;
};


export type SkillGraphViewDomain = {
  domain: string;
  label: string;
  count: number;
  color: string;
  enabled: boolean;
};


export type SkillGraphViewData = {
  nodes: SkillGraphViewNode[];
  links: SkillGraphViewLink[];
  domains: SkillGraphViewDomain[];
  stats: {
    skillCount: number;
    evidenceCount: number;
    linkCount: number;
  };
};


function normalizeQuery(query: string | undefined) {
  return query?.trim().toLowerCase() ?? "";
}


function primaryDomain(node: SkillGraphNode) {
  return node.domains[0] ?? "unknown";
}


function formatDomainLabel(domain: string) {
  return domain.replace(/_/g, " ");
}


function skillNodeValue(node: SkillGraphNode) {
  if (node.seed) {
    return 12;
  }
  return Math.max(3.2, Math.min(10, 3.2 + Math.sqrt(Math.max(0, node.demand_count)) * 1.15));
}


function linkValue(score: number) {
  return Math.max(0.3, Math.min(4.5, 0.4 + Math.max(0, score) * 4));
}


function buildDomainStats(
  graph: SkillGraphResponse,
  enabledDomains: string[] | undefined,
): SkillGraphViewDomain[] {
  const counts = new Map<string, number>();
  graph.nodes.forEach((node) => {
    const domain = primaryDomain(node);
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  });

  const enabledSet = enabledDomains === undefined ? null : new Set(enabledDomains);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([domain, count]) => ({
      domain,
      label: formatDomainLabel(domain),
      count,
      color: domainColor(domain),
      enabled: enabledSet ? enabledSet.has(domain) : true,
    }));
}


function matchesQuery(node: SkillGraphNode, query: string) {
  if (!query) {
    return true;
  }
  const searchable = [
    node.id,
    node.label,
    node.category,
    node.kind,
    ...node.domains,
  ].join(" ");
  return searchable.toLowerCase().includes(query);
}


function collectLocalIds(
  selectedId: string,
  depth: number,
  allowedIds: Set<string>,
  links: Array<{ source: string; target: string }>,
) {
  if (!allowedIds.has(selectedId)) {
    return new Set<string>();
  }

  const adjacency = new Map<string, Set<string>>();
  links.forEach((link) => {
    if (!allowedIds.has(link.source) || !allowedIds.has(link.target)) {
      return;
    }
    if (!adjacency.has(link.source)) {
      adjacency.set(link.source, new Set());
    }
    if (!adjacency.has(link.target)) {
      adjacency.set(link.target, new Set());
    }
    adjacency.get(link.source)?.add(link.target);
    adjacency.get(link.target)?.add(link.source);
  });

  const visible = new Set<string>([selectedId]);
  let frontier = new Set<string>([selectedId]);
  for (let level = 0; level < Math.max(0, depth); level += 1) {
    const next = new Set<string>();
    frontier.forEach((id) => {
      adjacency.get(id)?.forEach((neighbor) => {
        if (!visible.has(neighbor)) {
          visible.add(neighbor);
          next.add(neighbor);
        }
      });
    });
    frontier = next;
  }
  return visible;
}


export function buildSkillGraphView(
  graph: SkillGraphResponse,
  options: SkillGraphViewOptions = {},
): SkillGraphViewData {
  const query = normalizeQuery(options.query);
  const enabledSet =
    options.enabledDomains === undefined ? null : new Set(options.enabledDomains);
  const mode = options.mode ?? "global";
  const showEvidence = options.showEvidence ?? true;
  const showIsolated = options.showIsolated ?? true;
  const localDepth = options.localDepth ?? 1;

  const skillCandidates = graph.nodes.filter((node) => {
    const domain = primaryDomain(node);
    const domainAllowed = enabledSet ? enabledSet.has(domain) : true;
    return domainAllowed && matchesQuery(node, query);
  });
  const candidateIds = new Set(skillCandidates.map((node) => node.id));
  const candidateSkillLinks = graph.edges.filter(
    (edge) => candidateIds.has(edge.source) && candidateIds.has(edge.target),
  );

  let visibleSkillIds =
    mode === "local" && options.selectedId
      ? collectLocalIds(
          options.selectedId,
          localDepth,
          candidateIds,
          candidateSkillLinks,
        )
      : new Set(candidateIds);

  if (!showIsolated) {
    const connectedIds = new Set<string>();
    candidateSkillLinks.forEach((edge) => {
      if (!visibleSkillIds.has(edge.source) || !visibleSkillIds.has(edge.target)) {
        return;
      }
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    });
    visibleSkillIds = connectedIds;
  }

  const skillNodes = skillCandidates
    .filter((node) => visibleSkillIds.has(node.id))
    .map<SkillGraphViewNode>((node) => {
      const domain = primaryDomain(node);
      return {
        id: node.id,
        label: node.label,
        kind: "skill",
        category: node.category,
        domain,
        domains: node.domains,
        color: domainColor(domain),
        val: skillNodeValue(node),
        demandCount: node.demand_count,
        owned: node.owned,
        seed: node.seed,
        skill: node,
      };
    });

  const skillLinks = candidateSkillLinks
    .filter((edge) => visibleSkillIds.has(edge.source) && visibleSkillIds.has(edge.target))
    .map<SkillGraphViewLink>((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: "skill",
      score: edge.score,
      value: linkValue(edge.score),
    }));

  const evidenceNodes: SkillGraphViewNode[] = [];
  const evidenceLinks: SkillGraphViewLink[] = [];

  if (showEvidence) {
    graph.evidence.forEach((item) => {
      const linkedSkills = item.skills.filter((skill) => visibleSkillIds.has(skill));
      if (linkedSkills.length === 0) {
        return;
      }

      const id = `posting:${item.posting_id}`;
      evidenceNodes.push({
        id,
        label: item.company_name,
        kind: "posting",
        category: "posting",
        domain: "posting",
        domains: ["posting"],
        color: "rgba(218, 224, 236, 0.76)",
        val: Math.max(1.8, Math.min(4.4, 1.8 + linkedSkills.length * 0.36)),
        demandCount: linkedSkills.length,
        owned: false,
        seed: false,
        evidence: item,
      });

      linkedSkills.forEach((skill) => {
        evidenceLinks.push({
          id: `${id}:${skill}`,
          source: id,
          target: skill,
          kind: "evidence",
          score: 0.16,
          value: 0.35,
        });
      });
    });
  }

  const nodes = [...skillNodes, ...evidenceNodes];
  const links = [...skillLinks, ...evidenceLinks];

  return {
    nodes,
    links,
    domains: buildDomainStats(graph, options.enabledDomains),
    stats: {
      skillCount: skillNodes.length,
      evidenceCount: evidenceNodes.length,
      linkCount: links.length,
    },
  };
}
