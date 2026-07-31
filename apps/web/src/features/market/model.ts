import type { ResourceState } from "@/features/home-feed/resource-state";
import { classifyPostingDomains } from "@/features/career-analysis/model";
import { formatDomainLabel } from "@/features/career/model";
import { stableCompanyIdentity } from "@/lib/company-identity";
import { formatCareer, formatEmployment, formatLocation } from "@/lib/labels";
import {
  SKILL_CATEGORIES,
  normalizeSkillCategory,
  skillCategoryLabel,
  type SkillCategory,
} from "@/lib/skill-categories";
import type {
  PostingListResponse,
  MarketCareerFieldsResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

export type MarketCareerType = "" | "new_comer" | "experienced" | "mixed";
export type MarketSort =
  | "companies"
  | "explicit"
  | "demand"
  | "required"
  | "preferred"
  | "name";

export type MarketSkill = {
  id: string;
  name: string;
  category: string;
  categoryLabel: string;
  companyCount: number;
  postingCount: number;
  explicitCount: number;
  requiredCount: number;
  preferredCount: number;
  unspecifiedCount: number;
  relativeCompanyBreadth: number;
  relativeExplicitDemand: number;
  skillHref: string;
  jobsHref: string;
};

export type MarketJob = {
  id: string;
  companyName: string;
  companySlug?: string;
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

export type MarketField = {
  domain: string;
  label: string;
  postingCount: number;
  companyCount: number;
  careerCounts: {
    newComer: number;
    experienced: number;
    mixedOrUnknown: number;
  };
  topLocations: string[];
  topSkills: string[];
  jobs: MarketJob[];
  sampleStatus?: "comparable" | "limited";
  topSkillDemand?: Array<{
    skill: string;
    postingCount: number;
    companyCount: number;
  }>;
};

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
    if (sort === "explicit") {
      return (
        right.explicitCount - left.explicitCount ||
        right.postingCount - left.postingCount ||
        compareName(left, right)
      );
    }
    if (sort === "required") {
      return right.requiredCount - left.requiredCount || compareName(left, right);
    }
    if (sort === "preferred") {
      return right.preferredCount - left.preferredCount || compareName(left, right);
    }
    if (sort === "companies") {
      return (
        right.companyCount - left.companyCount ||
        right.explicitCount - left.explicitCount ||
        right.postingCount - left.postingCount ||
        compareName(left, right)
      );
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
  field?: string;
  postings: ResourceState<PostingListResponse>;
  skillStats: ResourceState<SkillStatsResponse>;
  graph?: ResourceState<SkillGraphResponse>;
  careerFields?: ResourceState<MarketCareerFieldsResponse>;
}) {
  const category = input.category ?? "";
  const postings = input.postings.status === "ready" ? input.postings.data : null;
  const skillStats =
    input.skillStats.status === "ready" ? input.skillStats.data : null;
  const orderedSkills = [...(skillStats?.items ?? [])].sort(
    (left, right) =>
      right.count - left.count || left.skill.localeCompare(right.skill),
  );
  const maxExplicitDemand = Math.max(
    1,
    ...orderedSkills.map(
      (item) => (item.required_count ?? 0) + (item.preferred_count ?? 0),
    ),
  );
  const maxCompanyCount = Math.max(
    1,
    ...orderedSkills.map((item) => item.company_count ?? 0),
  );
  const jobs = (postings?.items ?? []).map((item): MarketJob => ({
    id: item.id,
    companyName: item.company_name,
    ...(item.company_slug ? { companySlug: item.company_slug } : {}),
    title: item.title,
    careerLabel: formatCareer(item.career_type),
    employmentLabel: formatEmployment(item.employment_type),
    location: formatLocation(item.location),
    verifiedAt: item.last_verified_at,
    sourceUrl: item.source_url,
    skills: normalizedJobSkills([
      item.required_skills,
      item.preferred_skills,
      item.unspecified_skills,
    ]),
    href: `/jobs/${encodeURIComponent(item.id)}`,
  }));
  const graph = input.graph?.status === "ready" ? input.graph.data : null;
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  type FieldAccumulator = {
    postingIds: Set<string>;
    companies: Set<string>;
    careerCounts: MarketField["careerCounts"];
    locations: Map<string, number>;
    skills: Map<string, number>;
    jobs: MarketJob[];
  };
  const accumulators = new Map<string, FieldAccumulator>();
  const classifiedPostingIds = new Set<string>();
  for (const posting of postings?.items ?? []) {
    const job = jobById.get(posting.id);
    const domains = classifyPostingDomains(posting);
    if (domains.length > 0) classifiedPostingIds.add(posting.id);
    for (const domainEvidence of domains) {
      const domain = domainEvidence.domain;
      const accumulator = accumulators.get(domain) ?? {
        postingIds: new Set<string>(),
        companies: new Set<string>(),
        careerCounts: { newComer: 0, experienced: 0, mixedOrUnknown: 0 },
        locations: new Map<string, number>(),
        skills: new Map<string, number>(),
        jobs: [],
      };
      if (!accumulator.postingIds.has(posting.id)) {
        accumulator.postingIds.add(posting.id);
        accumulator.companies.add(
          stableCompanyIdentity(posting),
        );
        if (posting.career_type === "new_comer") {
          accumulator.careerCounts.newComer += 1;
        } else if (posting.career_type === "experienced") {
          accumulator.careerCounts.experienced += 1;
        } else {
          accumulator.careerCounts.mixedOrUnknown += 1;
        }
        if (posting.location) {
          const location = formatLocation(posting.location);
          accumulator.locations.set(
            location,
            (accumulator.locations.get(location) ?? 0) + 1,
          );
        }
        if (job) accumulator.jobs.push(job);
      }
      for (const skill of normalizedJobSkills([
        posting.required_skills,
        posting.preferred_skills,
        posting.unspecified_skills,
      ])) {
        accumulator.skills.set(
          skill,
          (accumulator.skills.get(skill) ?? 0) + 1,
        );
      }
      accumulators.set(domain, accumulator);
    }
  }
  const legacyFields: MarketField[] = [...accumulators.entries()]
    .map(([domain, accumulator]) => ({
      domain,
      label: formatDomainLabel(domain),
      postingCount: accumulator.postingIds.size,
      companyCount: accumulator.companies.size,
      careerCounts: accumulator.careerCounts,
      topLocations: [...accumulator.locations.entries()]
        .sort(
          (left, right) =>
            right[1] - left[1] || left[0].localeCompare(right[0], "ko-KR"),
        )
        .slice(0, 4)
        .map(([location]) => location),
      topSkills: [...accumulator.skills.entries()]
        .sort(
          (left, right) =>
            right[1] - left[1] || left[0].localeCompare(right[0], "en"),
        )
        .slice(0, 6)
        .map(([skill]) => skill),
      jobs: accumulator.jobs
        .sort(
          (left, right) =>
            Date.parse(right.verifiedAt) - Date.parse(left.verifiedAt),
        )
        .slice(0, 4),
    }))
    .sort(
      (left, right) =>
        right.postingCount - left.postingCount ||
        left.label.localeCompare(right.label, "ko-KR"),
    );
  const careerFields = input.careerFields?.status === "ready"
    ? input.careerFields.data
    : null;
  const fields: MarketField[] = careerFields
    ? careerFields.fields.map((field) => ({
        domain: field.domain,
        label: field.label,
        postingCount: field.posting_count,
        companyCount: field.company_count,
        careerCounts: {
          newComer: field.career_counts.new_comer,
          experienced: field.career_counts.experienced,
          mixedOrUnknown: field.career_counts.mixed_or_unknown,
        },
        topLocations: field.top_locations.map((item) => formatLocation(item.label)),
        topSkills: field.top_skills.map((item) => item.skill),
        topSkillDemand: field.top_skills.map((item) => ({
          skill: item.skill,
          postingCount: item.posting_count,
          companyCount: item.company_count,
        })),
        sampleStatus: field.sample_status,
        jobs: field.jobs.map((item) => ({
          id: item.id,
          companyName: item.company_name,
          ...(item.company_slug ? { companySlug: item.company_slug } : {}),
          title: item.title,
          careerLabel: formatCareer(item.career_type),
          employmentLabel: formatEmployment(item.employment_type),
          location: formatLocation(item.location),
          verifiedAt: item.last_verified_at,
          sourceUrl: item.source_url,
          skills: normalizedJobSkills([
            item.required_skills,
            item.preferred_skills,
            item.unspecified_skills,
          ]),
          href: `/jobs/${encodeURIComponent(item.id)}`,
        })),
      }))
    : input.careerFields
      ? []
      : legacyFields;
  const requestedField = input.field?.trim() ?? "";
  const selectedField = fields.some((field) => field.domain === requestedField)
    ? requestedField
    : fields[0]?.domain ?? "";

  return {
    careerType: input.careerType,
    category,
    selectedField,
    fields,
    fieldError:
      input.careerFields?.status === "error"
        ? input.careerFields.message
        : input.postings.status === "error"
          ? input.postings.message
          : null,
    graphError:
      input.graph?.status === "error" ? input.graph.message : null,
    fieldScope: {
      evidencePostingCount:
        careerFields?.classified_posting_count ?? classifiedPostingIds.size,
      analyzedPostingCount:
        careerFields?.analyzed_posting_count ?? postings?.items.length ?? 0,
      analyzedCompanyCount:
        careerFields?.analyzed_company_count ?? 0,
      graphSkillCount: graph?.nodes.length ?? 0,
      graphLimit: graph?.meta.limit ?? null,
    },
    categoryLabel: skillCategoryLabel(category),
    jobsBrowseHref: buildMarketBrowseJobsHref(
      input.careerType,
      category,
    ),
    postingTotal: careerFields?.analyzed_posting_count ?? postings?.total ?? null,
    postingCountLabel: formatPostingCoverage(
      careerFields?.analyzed_posting_count ?? postings?.total ?? null,
    ),
    skillTotal: skillStats?.total ?? null,
    latestVerifiedAt: careerFields?.calculated_at ?? latestValidDate(
      (postings?.items ?? []).map((item) => item.last_verified_at),
    ),
    postingError:
      input.postings.status === "error" ? input.postings.message : null,
    skillError:
      input.skillStats.status === "error" ? input.skillStats.message : null,
    skills: orderedSkills.map((item): MarketSkill => {
      const requiredCount = item.required_count ?? 0;
      const preferredCount = item.preferred_count ?? 0;
      const explicitCount = requiredCount + preferredCount;
      return {
        id: skillIdentity(item.category, item.skill),
        name: item.skill,
        category: item.category,
        categoryLabel: skillCategoryLabel(normalizeSkillCategory(item.category)),
        companyCount: item.company_count ?? 0,
        postingCount: item.count,
        explicitCount,
        requiredCount,
        preferredCount,
        unspecifiedCount: item.unspecified_count ?? 0,
        relativeCompanyBreadth: Math.round(
          ((item.company_count ?? 0) / maxCompanyCount) * 100,
        ),
        relativeExplicitDemand: Math.round(
          (explicitCount / maxExplicitDemand) * 100,
        ),
        skillHref: `/skills/graph?seed=${encodeURIComponent(item.skill)}`,
        jobsHref: buildMarketJobsHref(
          item.skill,
          input.careerType,
          category,
        ),
      };
    }),
    jobs,
  };
}

export type MarketOverviewSnapshot = ReturnType<
  typeof buildMarketOverviewSnapshot
>;
