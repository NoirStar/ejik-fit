import { skillIdentityKey } from "./skill-catalog";
import type {
  SkillGraphEdge,
  SkillGraphEvidence,
  SkillGraphNode,
  SkillGraphResponse,
} from "./types";


function edgeIdentity(edge: Pick<SkillGraphEdge, "source" | "target">) {
  return [skillIdentityKey(edge.source), skillIdentityKey(edge.target)]
    .sort((left, right) => left.localeCompare(right, "en"))
    .join("::");
}


export function graphContainsSkill(
  graph: SkillGraphResponse,
  skill: string,
) {
  const target = skillIdentityKey(skill);
  return Boolean(
    target && graph.nodes.some((node) => skillIdentityKey(node.id) === target),
  );
}


/**
 * Adds a rare skill neighborhood to the public market atlas. The atlas keeps
 * ownership of shared values and ordering so the default spatial view remains
 * deterministic. Neighborhood seed markers are cleared because selecting a
 * node and changing the map scope are separate interactions in the atlas.
 */
export function mergeSkillGraphResponses(
  atlas: SkillGraphResponse,
  neighborhood: SkillGraphResponse,
): SkillGraphResponse {
  const nodeByIdentity = new Map<string, SkillGraphNode>();
  const nodes: SkillGraphNode[] = [];

  function addNode(node: SkillGraphNode) {
    const identity = skillIdentityKey(node.id);
    if (!identity || nodeByIdentity.has(identity)) return;
    const mergedNode = { ...node, seed: false };
    nodeByIdentity.set(identity, mergedNode);
    nodes.push(mergedNode);
  }

  atlas.nodes.forEach(addNode);
  neighborhood.nodes.forEach(addNode);

  const canonicalId = new Map(
    nodes.map((node) => [skillIdentityKey(node.id), node.id] as const),
  );
  const edgeByIdentity = new Map<string, SkillGraphEdge>();
  const edges: SkillGraphEdge[] = [];

  function addEdge(edge: SkillGraphEdge) {
    const source = canonicalId.get(skillIdentityKey(edge.source));
    const target = canonicalId.get(skillIdentityKey(edge.target));
    if (!source || !target || source === target) return;
    const normalized = { ...edge, source, target };
    const identity = edgeIdentity(normalized);
    if (edgeByIdentity.has(identity)) return;
    edgeByIdentity.set(identity, normalized);
    edges.push(normalized);
  }

  atlas.edges.forEach(addEdge);
  neighborhood.edges.forEach(addEdge);

  const evidenceByPosting = new Map<string, SkillGraphEvidence>();
  [...atlas.evidence, ...neighborhood.evidence].forEach((item) => {
    if (!evidenceByPosting.has(item.posting_id)) {
      evidenceByPosting.set(item.posting_id, { ...item });
    }
  });

  const atlasSeed = atlas.seed ? skillIdentityKey(atlas.seed) : "";
  if (atlasSeed) {
    const selected = nodeByIdentity.get(atlasSeed);
    if (selected) selected.seed = true;
  }

  return {
    seed: atlas.seed,
    nodes,
    edges,
    evidence: [...evidenceByPosting.values()],
    meta: {
      ...atlas.meta,
      limit: nodes.length,
    },
  };
}
