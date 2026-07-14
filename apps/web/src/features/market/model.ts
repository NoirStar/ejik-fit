import type { ResourceState } from "@/features/home-feed/resource-state";
import { formatCareer, formatEmployment } from "@/lib/labels";
import {
  SKILL_CATEGORIES,
  normalizeSkillCategory,
  skillCategoryLabel,
  type SkillCategory,
} from "@/lib/skill-categories";
import type { PostingListResponse, SkillStatsResponse } from "@/lib/types";

export type MarketCareerType = "" | "new_comer" | "experienced" | "mixed";

export const MARKET_CAREER_FILTERS = [
  { value: "", label: "전체" },
  { value: "new_comer", label: "신입" },
  { value: "experienced", label: "경력" },
  { value: "mixed", label: "신입·경력" },
] as const satisfies ReadonlyArray<{
  value: MarketCareerType;
  label: string;
}>;

export const MARKET_CATEGORIES = SKILL_CATEGORIES;
export const normalizeMarketCategory = normalizeSkillCategory;

const SUPPORTED_CAREER_TYPES = new Set<MarketCareerType>([
  "",
  "new_comer",
  "experienced",
  "mixed",
]);

export function normalizeMarketCareerType(
  value: string | string[] | undefined,
): MarketCareerType {
  const first = Array.isArray(value) ? value[0] ?? "" : value ?? "";
  return SUPPORTED_CAREER_TYPES.has(first as MarketCareerType)
    ? (first as MarketCareerType)
    : "";
}

export function buildMarketFilterHref(
  careerType: MarketCareerType,
  category: SkillCategory = "",
) {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  if (careerType) {
    params.set("career_type", careerType);
  }
  const query = params.toString();
  return `/market${query ? `?${query}` : ""}`;
}

export function buildMarketJobsHref(
  skill: string,
  careerType: MarketCareerType,
  category: SkillCategory = "",
) {
  const params = new URLSearchParams({ q: skill });
  if (category) {
    params.set("category", category);
  }
  if (careerType) {
    params.set("career_type", careerType);
  }
  return `/jobs?${params.toString()}`;
}

export function buildMarketBrowseJobsHref(
  careerType: MarketCareerType,
  category: SkillCategory,
) {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  if (careerType) {
    params.set("career_type", careerType);
  }
  const query = params.toString();
  return `/jobs${query ? `?${query}` : ""}`;
}

function latestValidDate(values: string[]) {
  return (
    values
      .filter((value) => !Number.isNaN(Date.parse(value)))
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null
  );
}

export function buildMarketOverviewSnapshot(input: {
  careerType: MarketCareerType;
  category?: SkillCategory;
  postings: ResourceState<PostingListResponse>;
  skillStats: ResourceState<SkillStatsResponse>;
}) {
  const category = input.category ?? "";
  const postings = input.postings.status === "ready" ? input.postings.data : null;
  const skillStats =
    input.skillStats.status === "ready" ? input.skillStats.data : null;
  const orderedSkills = [...(skillStats?.items ?? [])].sort(
    (left, right) =>
      right.count - left.count || left.skill.localeCompare(right.skill),
  );
  const maxDemand = Math.max(1, ...orderedSkills.map((item) => item.count));

  return {
    careerType: input.careerType,
    category,
    categoryLabel: skillCategoryLabel(category),
    jobsBrowseHref: buildMarketBrowseJobsHref(
      input.careerType,
      category,
    ),
    postingTotal: postings?.total ?? null,
    skillTotal: skillStats?.items.length ?? null,
    latestVerifiedAt: latestValidDate(
      (postings?.items ?? []).map((item) => item.last_verified_at),
    ),
    postingError:
      input.postings.status === "error" ? input.postings.message : null,
    skillError:
      input.skillStats.status === "error" ? input.skillStats.message : null,
    skills: orderedSkills.map((item) => ({
      name: item.skill,
      category: item.category,
      postingCount: item.count,
      requiredCount: item.required_count ?? 0,
      preferredCount: item.preferred_count ?? 0,
      unspecifiedCount: item.unspecified_count ?? 0,
      relativeDemand: Math.round((item.count / maxDemand) * 100),
      skillHref: `/skill-map?skill=${encodeURIComponent(item.skill)}`,
      jobsHref: buildMarketJobsHref(
        item.skill,
        input.careerType,
        category,
      ),
    })),
    jobs: (postings?.items ?? []).slice(0, 5).map((item) => ({
      id: item.id,
      companyName: item.company_name,
      title: item.title,
      careerLabel: formatCareer(item.career_type),
      employmentLabel: formatEmployment(item.employment_type),
      location: item.location ?? "근무지 미기재",
      verifiedAt: item.last_verified_at,
      href: `/jobs/${encodeURIComponent(item.id)}`,
    })),
  };
}

export type MarketOverviewSnapshot = ReturnType<
  typeof buildMarketOverviewSnapshot
>;
