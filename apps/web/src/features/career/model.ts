import { normalizeOwnedSkills } from "@/lib/owned-skills";
import type { FitAnalyzeRequest, FitAnalyzeResponse } from "@/lib/types";

export type CareerCondition = "" | "new_comer" | "experienced" | "mixed";

export const CAREER_CONDITIONS = [
  { value: "", label: "전체" },
  { value: "new_comer", label: "신입" },
  { value: "experienced", label: "경력" },
  { value: "mixed", label: "신입·경력" },
] as const satisfies ReadonlyArray<{
  value: CareerCondition;
  label: string;
}>;

const DOMAIN_LABELS: Record<string, string> = {
  ai: "AI",
  autonomy: "자율주행",
  automotive: "자동차",
  backend: "백엔드",
  cloud: "클라우드",
  computer_vision: "컴퓨터 비전",
  data: "데이터",
  design: "디자인",
  devops: "DevOps",
  embedded: "임베디드",
  frontend: "프론트엔드",
  game: "게임",
  graphics: "그래픽스",
  hardware: "하드웨어",
  high_performance: "고성능 컴퓨팅",
  mlops: "MLOps",
  mobile: "모바일",
  product: "프로덕트",
  qa: "QA",
  robotics: "로보틱스",
  security: "보안",
  web: "웹",
};

export function careerConditionLabel(condition: CareerCondition) {
  return (
    CAREER_CONDITIONS.find((item) => item.value === condition)?.label ?? "전체"
  );
}

export function formatDomainLabel(domain: string) {
  return DOMAIN_LABELS[domain] ?? domain;
}

export type CareerDomainSuggestion = {
  value: string;
  label: string;
  skillCount: number;
};

export function buildCareerDomainSuggestions(
  value: unknown,
): CareerDomainSuggestion[] {
  if (!value || typeof value !== "object") {
    throw new Error("invalid domain suggestion response");
  }
  const nodes = (value as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) {
    throw new Error("invalid domain suggestion response");
  }

  const counts = new Map<string, number>();
  const seenNodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node || typeof node !== "object") {
      throw new Error("invalid domain suggestion node");
    }
    const candidate = node as { id?: unknown; domains?: unknown };
    if (typeof candidate.id !== "string" || !candidate.id.trim()) {
      throw new Error("invalid domain suggestion node");
    }
    const nodeId = candidate.id.trim().toLocaleLowerCase("en-US");
    if (seenNodeIds.has(nodeId)) {
      throw new Error("duplicate domain suggestion node");
    }
    seenNodeIds.add(nodeId);

    const domains = candidate.domains;
    if (
      !Array.isArray(domains) ||
      !domains.every((domain) => typeof domain === "string")
    ) {
      throw new Error("invalid domain suggestion node");
    }
    const nodeDomains = new Set(
      domains.map((domain) => domain.trim()).filter(Boolean),
    );
    for (const domain of nodeDomains) {
      counts.set(domain, (counts.get(domain) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([domain, skillCount]) => ({
      value: domain,
      label: formatDomainLabel(domain),
      skillCount,
    }))
    .sort(
      (left, right) =>
        right.skillCount - left.skillCount ||
        left.label.localeCompare(right.label, "ko-KR"),
    );
}

export function careerScopeLabel(
  careerCondition: CareerCondition,
  targetDomain: string,
) {
  const parts = [
    targetDomain ? formatDomainLabel(targetDomain) : "",
    careerCondition ? careerConditionLabel(careerCondition) : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "전체";
}

export function buildCareerAnalyzePayload(
  ownedSkills: string[],
  careerCondition: CareerCondition,
  targetDomain = "",
): FitAnalyzeRequest {
  const payload: FitAnalyzeRequest = {
    owned_skills: normalizeOwnedSkills(ownedSkills),
  };
  if (careerCondition) {
    payload.career_type = careerCondition;
  }
  if (targetDomain.trim()) {
    payload.domains = [targetDomain.trim()];
  }
  return payload;
}

export function buildCareerJobsHref(
  skill: string,
  careerCondition: CareerCondition,
) {
  const params = new URLSearchParams({ q: skill });
  if (careerCondition) {
    params.set("career_type", careerCondition);
  }
  return `/jobs?${params.toString()}`;
}

export function buildCareerSnapshot(
  fit: FitAnalyzeResponse,
  careerCondition: CareerCondition,
  targetDomain = "",
) {
  return {
    careerCondition,
    careerConditionLabel: careerConditionLabel(careerCondition),
    targetDomain,
    targetDomainLabel: targetDomain
      ? formatDomainLabel(targetDomain)
      : "전체 기술 분야",
    scopeLabel: careerScopeLabel(careerCondition, targetDomain),
    metrics: {
      matchingPostingCount: fit.coverage.matching_posting_count,
      strongFitPostingCount: fit.coverage.strong_fit_posting_count,
      recommendationCount: fit.recommended_next_skills.length,
    },
    recommendations: fit.recommended_next_skills.slice(0, 6).map((item) => ({
      name: item.skill,
      requiredCount: item.required_count,
      preferredCount: item.preferred_count,
      supportingPostingCount: item.supporting_posting_count,
      skillHref: `/skill-map?skill=${encodeURIComponent(item.skill)}`,
      jobsHref: buildCareerJobsHref(item.skill, careerCondition),
    })),
    branches: [...fit.domain_branches]
      .sort(
        (left, right) =>
          right.supporting_posting_count - left.supporting_posting_count ||
          left.domain.localeCompare(right.domain),
      )
      .slice(0, 4)
      .map((branch) => ({
        domain: branch.domain,
        label: formatDomainLabel(branch.domain),
        coveredSkills: branch.covered_skills,
        missingRequiredSkills: branch.missing_required_skills,
        missingPreferredSkills: branch.missing_preferred_skills,
        supportingPostingCount: branch.supporting_posting_count,
      })),
  };
}

export type CareerSnapshot = ReturnType<typeof buildCareerSnapshot>;
