import type { CareerProfile } from "@/lib/career-profile";
import { normalizePostingList } from "@/lib/posting-contract";
import type {
  CareerAnalyzeRequest,
  CareerAnalyzeResponse,
  CareerJobConnection,
} from "@/lib/types";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function connection(value: unknown): value is CareerJobConnection {
  return (
    isObject(value) &&
    typeof value.label === "string" &&
    typeof value.recommendation_eligible === "boolean" &&
    stringArray(value.reasons) &&
    stringArray(value.evidence_types) &&
    stringArray(value.matched_skills) &&
    stringArray(value.matched_responsibilities) &&
    stringArray(value.unconfirmed_conditions) &&
    ["continues", "check", "changes"].includes(String(value.career_condition)) &&
    ["continues", "check", "changes"].includes(String(value.employment_condition)) &&
    ["continues", "check", "changes"].includes(String(value.location_condition))
  );
}

export function careerAnalysisRequest(
  profile: CareerProfile,
  ownedSkills: string[],
  options: {
    direction?: string;
    q?: string;
    careerType?: string;
    category?: string;
    connectionIds?: string[];
    limit?: number;
    offset?: number;
  } = {},
): CareerAnalyzeRequest {
  return {
    profile: {
      current_role: profile.currentRole,
      past_roles: profile.pastRoles,
      experience_years: profile.experienceYears,
      responsibilities: profile.responsibilities,
      keep_experience: profile.keepExperience,
      experience_highlights: profile.experienceHighlights.map((item) => ({
        title: item.title,
        responsibilities: item.responsibilities,
        outcome: item.outcome,
        domain: item.domain,
        skills: item.skills,
      })),
      work_types: profile.workTypes,
      industry_experience: profile.industryExperience,
      current_domain: profile.currentDomain,
      interest_domains: profile.interestDomains,
      excluded_domains: profile.excludedDomains,
      preferred_locations: profile.preferredLocations,
      employment_types: profile.employmentTypes,
      career_level: profile.careerLevel,
      skill_usage: Object.fromEntries(
        Object.entries(profile.skillUsage).map(([skill, usage]) => [
          skill,
          { years: usage.years, last_used: usage.lastUsed },
        ]),
      ),
    },
    owned_skills: ownedSkills,
    ...(options.direction ? { direction: options.direction } : {}),
    ...(options.q ? { q: options.q } : {}),
    ...(options.careerType ? { career_type: options.careerType } : {}),
    ...(options.category ? { category: options.category } : {}),
    ...(options.connectionIds?.length
      ? { connection_ids: options.connectionIds.slice(0, 100) }
      : {}),
    limit: options.limit ?? 12,
    offset: options.offset ?? 0,
  };
}

export function normalizeCareerAnalysis(value: unknown): CareerAnalyzeResponse {
  if (!isObject(value) || !isObject(value.recommendations)) {
    throw new TypeError("Invalid career analysis response");
  }
  const directions = value.directions;
  const recommendationItems = value.recommendations.items;
  const rawConnections = value.connections;
  if (
    typeof value.version !== "string" ||
    typeof value.snapshot_id !== "string" ||
    typeof value.analyzed_posting_count !== "number" ||
    typeof value.analyzed_company_count !== "number" ||
    !Array.isArray(directions) ||
    !Array.isArray(recommendationItems) ||
    !isObject(rawConnections) ||
    typeof value.recommendations.total !== "number" ||
    typeof value.recommendations.limit !== "number" ||
    typeof value.recommendations.offset !== "number" ||
    !stringArray(value.profile_evidence_used) ||
    !stringArray(value.profile_information_not_confirmed)
  ) {
    throw new TypeError("Invalid career analysis response");
  }

  const connections = Object.fromEntries(
    Object.entries(rawConnections).map(([id, item]) => {
      if (!connection(item)) throw new TypeError("Invalid career connection");
      return [id, item];
    }),
  );
  const normalizedItems = recommendationItems.map((item) => {
    if (!isObject(item) || !connection(item.connection)) {
      throw new TypeError("Invalid career recommendation");
    }
    const posting = normalizePostingList({ items: [item.posting], total: 1 }).items[0];
    return { posting, connection: item.connection };
  });
  for (const item of directions) {
    if (
      !isObject(item) ||
      typeof item.domain !== "string" ||
      typeof item.label !== "string" ||
      !["direct", "adjacent", "interest", "transition"].includes(String(item.kind)) ||
      !stringArray(item.reasons) ||
      !stringArray(item.evidence_types) ||
      !stringArray(item.matched_skills) ||
      !stringArray(item.additional_conditions) ||
      !stringArray(item.representative_tasks) ||
      !isObject(item.career_counts) ||
      typeof item.posting_count !== "number" ||
      typeof item.company_count !== "number"
    ) {
      throw new TypeError("Invalid career direction");
    }
  }

  return {
    ...(value as unknown as CareerAnalyzeResponse),
    connections,
    recommendations: {
      items: normalizedItems,
      total: value.recommendations.total,
      limit: value.recommendations.limit,
      offset: value.recommendations.offset,
    },
  };
}
