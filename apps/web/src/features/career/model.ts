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

export function buildCareerAnalyzePayload(
  ownedSkills: string[],
  careerCondition: CareerCondition,
): FitAnalyzeRequest {
  const payload: FitAnalyzeRequest = {
    owned_skills: normalizeOwnedSkills(ownedSkills),
  };
  if (careerCondition) {
    payload.career_type = careerCondition;
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
) {
  return {
    careerCondition,
    careerConditionLabel: careerConditionLabel(careerCondition),
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
