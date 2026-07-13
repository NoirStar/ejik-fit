import { formatCareer } from "@/lib/labels";
import type {
  PostingListResponse,
  SkillGraphEvidence,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

import {
  dashboardStatus,
  type DashboardStatus,
  type ResourceState,
} from "./state";

export type DashboardSnapshot = {
  status: DashboardStatus;
  ownedSkills: string[];
  jobs: Array<{
    id: string;
    title: string;
    companyName: string;
    location: string;
    careerLabel: string;
    sourceUrl: string;
    lastVerifiedLabel: string;
    matchedSkills: string[];
    matchScore: number | null;
  }>;
  skillDemand: Array<{
    label: string;
    count: number;
    requiredCount: number;
    preferredCount: number;
  }>;
  adjacentSkills: Array<{ label: string; cooccurrenceCount: number }>;
  displayedPostingCount: number;
  displayedSourceCount: number;
  matchingPostingCount: number;
  lastVerifiedAt: string | null;
  fitLabel: "요구 기술 일치도";
};

type DashboardSnapshotInput = {
  postings: ResourceState<PostingListResponse>;
  skillStats: ResourceState<SkillStatsResponse>;
  graph: ResourceState<SkillGraphResponse>;
  ownedSkills: string[];
};

function readyData<T>(resource: ResourceState<T>): T | null {
  return resource.status === "ready" ? resource.data : null;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function unique(values: readonly string[]) {
  return Array.from(new Set(values));
}

function formatVerifiedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "확인 시각 미상";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function evidenceByPostingId(graph: SkillGraphResponse | null) {
  return new Map(
    (graph?.evidence ?? []).map((evidence) => [evidence.posting_id, evidence]),
  );
}

function matchDetails(
  evidence: SkillGraphEvidence | undefined,
  ownedSet: ReadonlySet<string>,
) {
  if (!evidence) {
    return { matchedSkills: [], matchScore: null };
  }

  const requirements = unique(evidence.skills);
  const matchedSkills = requirements.filter((skill) => ownedSet.has(normalize(skill)));
  const matchScore = requirements.length > 0
    ? Math.round((matchedSkills.length / requirements.length) * 100)
    : null;

  return { matchedSkills, matchScore };
}

function safeHostname(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname.toLocaleLowerCase("en-US");
  } catch {
    return sourceUrl;
  }
}

function latestVerifiedAt(values: readonly string[]) {
  const validValues = values.filter((value) => !Number.isNaN(new Date(value).getTime()));
  return validValues.sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

function buildAdjacentSkills(
  graph: SkillGraphResponse | null,
  ownedSet: ReadonlySet<string>,
) {
  if (!graph) return [];

  const nodeLabels = new Map(graph.nodes.map((node) => [node.id, node.label]));
  const counts = new Map<string, number>();

  for (const edge of graph.edges) {
    const sourceLabel = nodeLabels.get(edge.source) ?? edge.source;
    const targetLabel = nodeLabels.get(edge.target) ?? edge.target;
    const sourceOwned = ownedSet.has(normalize(sourceLabel));
    const targetOwned = ownedSet.has(normalize(targetLabel));
    if (sourceOwned === targetOwned) continue;

    const adjacentLabel = sourceOwned ? targetLabel : sourceLabel;
    counts.set(
      adjacentLabel,
      (counts.get(adjacentLabel) ?? 0) + edge.cooccurrence_count,
    );
  }

  return Array.from(counts, ([label, cooccurrenceCount]) => ({
    label,
    cooccurrenceCount,
  })).sort(
    (a, b) => b.cooccurrenceCount - a.cooccurrenceCount
      || a.label.localeCompare(b.label, "ko"),
  );
}

export function buildDashboardSnapshot(
  input: DashboardSnapshotInput,
): DashboardSnapshot {
  const postings = readyData(input.postings);
  const skillStats = readyData(input.skillStats);
  const graph = readyData(input.graph);
  const ownedSkills = unique(input.ownedSkills.map((skill) => skill.trim()).filter(Boolean));
  const ownedSet = new Set(ownedSkills.map(normalize));
  const evidenceMap = evidenceByPostingId(graph);

  const jobs = (postings?.items ?? []).map((posting) => {
    const details = matchDetails(evidenceMap.get(posting.id), ownedSet);
    return {
      id: posting.id,
      title: posting.title,
      companyName: posting.company_name,
      location: posting.location ?? "근무지 미기재",
      careerLabel: formatCareer(posting.career_type),
      sourceUrl: posting.source_url,
      lastVerifiedLabel: formatVerifiedDate(posting.last_verified_at),
      ...details,
    };
  });

  const sourceHosts = new Set(jobs.map((job) => safeHostname(job.sourceUrl)));
  const matchingPostingCount = jobs.filter((job) => job.matchedSkills.length > 0).length;

  return {
    status: dashboardStatus([input.postings, input.skillStats, input.graph]),
    ownedSkills,
    jobs,
    skillDemand: (skillStats?.items ?? []).map((skill) => ({
      label: skill.skill,
      count: skill.count,
      requiredCount: skill.required_count ?? 0,
      preferredCount: skill.preferred_count ?? 0,
    })),
    adjacentSkills: buildAdjacentSkills(graph, ownedSet),
    displayedPostingCount: jobs.length,
    displayedSourceCount: sourceHosts.size,
    matchingPostingCount,
    lastVerifiedAt: latestVerifiedAt(
      (postings?.items ?? []).map((posting) => posting.last_verified_at),
    ),
    fitLabel: "요구 기술 일치도",
  };
}
