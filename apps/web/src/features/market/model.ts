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
export type MarketSort = "demand" | "required" | "preferred" | "name";

export type MarketSkill = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  postingCount: number;
  requiredCount: number;
  preferredCount: number;
  unspecifiedCount: number;
  relativeDemand: number;
  skillHref: string;
  jobsHref: string;
};

export type MarketJob = {
  id: string;
  companyName: string;
  title: string;
  careerLabel: string;
  employmentLabel: string;
  location: string;
  verifiedAt: string;
  sourceUrl: string;
  skills: string[];
  href: string;
};

export type MarketSkillCombination = {
  id: string;
  skills: [string, string];
  postingCount: number;
};

const POSTING_RESULT_CAP = 100;

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

export function formatPostingCoverage(total: number | null) {
  if (total === null) {
    return "확인 불가";
  }
  if (total >= POSTING_RESULT_CAP) {
    return `${POSTING_RESULT_CAP}건 이상 확인`;
  }
  return `${total.toLocaleString("ko-KR")}건 확인`;
}

function skillIdentity(category: string, skill: string) {
  return `${category.trim().toLocaleLowerCase("en-US")}:${skill
    .trim()
    .toLocaleLowerCase("en-US")}`;
}

function normalizedJobSkills(values: Array<string[] | undefined>) {
  return Array.from(
    new Set(values.flatMap((value) => value ?? []).map((skill) => skill.trim()).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right, "en"));
}

function compareName(left: MarketSkill, right: MarketSkill) {
  return left.name.localeCompare(right.name, "en");
}

export function sortMarketSkills(
  skills: readonly MarketSkill[],
  sort: MarketSort,
) {
  return [...skills].sort((left, right) => {
    if (sort === "name") {
      return compareName(left, right);
    }
    if (sort === "required") {
      return right.requiredCount - left.requiredCount || compareName(left, right);
    }
    if (sort === "preferred") {
      return right.preferredCount - left.preferredCount || compareName(left, right);
    }
    return right.postingCount - left.postingCount || compareName(left, right);
  });
}

export function jobsForSkill(
  jobs: readonly MarketJob[],
  skill: string,
  limit = 5,
) {
  const target = skill.trim().toLocaleLowerCase("en-US");
  if (!target) {
    return jobs.slice(0, limit);
  }
  return jobs
    .filter((job) =>
      job.skills.some(
        (candidate) => candidate.toLocaleLowerCase("en-US") === target,
      ),
    )
    .slice(0, limit);
}

export function buildSkillCombinations(
  jobs: readonly MarketJob[],
  limit = 3,
  selectedSkill = "",
): MarketSkillCombination[] {
  const counts = new Map<string, MarketSkillCombination>();
  const selected = selectedSkill.trim().toLocaleLowerCase("en-US");

  jobs.forEach((job) => {
    const skills = normalizedJobSkills([job.skills]);
    for (let leftIndex = 0; leftIndex < skills.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < skills.length; rightIndex += 1) {
        const pair = [skills[leftIndex], skills[rightIndex]] as [string, string];
        const id = pair.join("::");
        const current = counts.get(id);
        counts.set(id, {
          id,
          skills: pair,
          postingCount: (current?.postingCount ?? 0) + 1,
        });
      }
    }
  });

  return [...counts.values()]
    .filter(
      (combination) =>
        !selected ||
        combination.skills.some(
          (skill) => skill.toLocaleLowerCase("en-US") === selected,
        ),
    )
    .sort(
      (left, right) =>
        right.postingCount - left.postingCount ||
        left.id.localeCompare(right.id, "en"),
    )
    .slice(0, limit);
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
    postingCountLabel: formatPostingCoverage(postings?.total ?? null),
    skillTotal: skillStats?.total ?? null,
    latestVerifiedAt: latestValidDate(
      (postings?.items ?? []).map((item) => item.last_verified_at),
    ),
    postingError:
      input.postings.status === "error" ? input.postings.message : null,
    skillError:
      input.skillStats.status === "error" ? input.skillStats.message : null,
    skills: orderedSkills.map((item): MarketSkill => ({
      id: skillIdentity(item.category, item.skill),
      name: item.skill,
      category: item.category,
      categoryLabel: skillCategoryLabel(normalizeSkillCategory(item.category)),
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
    jobs: (postings?.items ?? []).map((item): MarketJob => ({
      id: item.id,
      companyName: item.company_name,
      title: item.title,
      careerLabel: formatCareer(item.career_type),
      employmentLabel: formatEmployment(item.employment_type),
      location: item.location ?? "근무지 미기재",
      verifiedAt: item.last_verified_at,
      sourceUrl: item.source_url,
      skills: normalizedJobSkills([
        item.required_skills,
        item.preferred_skills,
        item.unspecified_skills,
      ]),
      href: `/jobs/${encodeURIComponent(item.id)}`,
    })),
  };
}

export type MarketOverviewSnapshot = ReturnType<
  typeof buildMarketOverviewSnapshot
>;
