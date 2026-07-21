import type {
  CommunityPostFeedItem,
  InterviewReviewFeedItem,
} from "@/features/home-feed/types";
import type { ResourceState } from "@/features/home-feed/resource-state";
import { localCommunityPostToFeedItem } from "@/features/home-feed/model";
import type { LocalCommunityPost } from "@/lib/local-community-posts";
import type {
  PostingListResponse,
  PostingSummary,
  SkillStatsResponse,
} from "@/lib/types";

export type SearchScope =
  | "all"
  | "companies"
  | "jobs"
  | "skills"
  | "community";

export type SearchDataStatus = "idle" | "ready" | "partial" | "error";

export const SEARCH_SCOPES = [
  { value: "all", label: "전체" },
  { value: "companies", label: "기업" },
  { value: "jobs", label: "공고" },
  { value: "skills", label: "기술" },
  { value: "community", label: "커뮤니티" },
] as const satisfies ReadonlyArray<{ value: SearchScope; label: string }>;

type CommunityItem = CommunityPostFeedItem | InterviewReviewFeedItem;

export type CompanySearchResult = {
  slug: string;
  name: string;
  href: string;
  postingCount: number;
  latestVerifiedAt: string | null;
  skillNames: string[];
  sourceUrl: string;
};

export type JobSearchResult = {
  id: string;
  title: string;
  companyName: string;
  companyHref: string | null;
  href: string;
  sourceUrl: string;
  careerType: string | null;
  employmentType: string | null;
  location: string | null;
  lastVerifiedAt: string;
  requiredSkills: string[];
  preferredSkills: string[];
  unspecifiedSkills: string[];
};

export type SkillSearchResult = {
  name: string;
  category: string;
  postingCount: number;
  requiredCount: number | null;
  preferredCount: number | null;
  unspecifiedCount: number | null;
  skillHref: string;
  jobsHref: string;
};

export type CommunitySearchResult = {
  id: string;
  category: string;
  title: string;
  summary: string;
  tags: string[];
  href: string;
  authorName: string;
  authorHeadline: string;
  createdLabel: string;
  source: "mock" | "local" | "server";
};

export type SearchSnapshot = {
  query: string;
  scope: SearchScope;
  dataStatus: SearchDataStatus;
  companies: CompanySearchResult[];
  jobs: JobSearchResult[];
  skills: SkillSearchResult[];
  community: CommunitySearchResult[];
  counts: {
    companies: number | null;
    jobs: number | null;
    skills: number | null;
    community: number;
  };
  errors: string[];
  hasAnyResults: boolean;
};

const SAFE_COMPANY_SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
const SEARCH_QUERY_LIMIT = 200;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function searchable(value: string) {
  return value.toLocaleLowerCase("ko-KR");
}

function safeCompanyHref(slug: string | undefined) {
  return slug && SAFE_COMPANY_SLUG.test(slug)
    ? `/companies/${encodeURIComponent(slug)}`
    : null;
}

function validTimestamp(value: string | null) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function uniqueSkills(posting: PostingSummary) {
  return Array.from(
    new Set([
      ...(posting.required_skills ?? []),
      ...(posting.preferred_skills ?? []),
      ...(posting.unspecified_skills ?? []),
    ]),
  );
}

export function normalizeSearchQuery(
  value: string | string[] | undefined,
) {
  return first(value).trim().replace(/\s+/g, " ").slice(0, SEARCH_QUERY_LIMIT);
}

export function normalizeSearchScope(
  value: string | string[] | undefined,
): SearchScope {
  const candidate = first(value);
  return SEARCH_SCOPES.some((scope) => scope.value === candidate)
    ? (candidate as SearchScope)
    : "all";
}

export function buildSearchScopeHref(query: string, scope: SearchScope) {
  const params = new URLSearchParams();
  const normalizedQuery = normalizeSearchQuery(query);
  if (normalizedQuery) params.set("q", normalizedQuery);
  if (scope !== "all") params.set("scope", scope);
  const serialized = params.toString();
  return `/search${serialized ? `?${serialized}` : ""}`;
}

function buildCompanies(postings: PostingSummary[]) {
  const groups = new Map<
    string,
    {
      name: string;
      postingCount: number;
      latestVerifiedAt: string | null;
      skillCounts: Map<string, number>;
      sourceUrl: string;
    }
  >();

  for (const posting of postings) {
    const slug = posting.company_slug;
    if (!slug || !SAFE_COMPANY_SLUG.test(slug)) continue;

    const current = groups.get(slug) ?? {
      name: posting.company_name,
      postingCount: 0,
      latestVerifiedAt: null,
      skillCounts: new Map<string, number>(),
      sourceUrl: posting.source_url,
    };
    current.postingCount += 1;

    if (
      validTimestamp(posting.last_verified_at) >
      validTimestamp(current.latestVerifiedAt)
    ) {
      current.latestVerifiedAt = posting.last_verified_at;
      current.sourceUrl = posting.source_url;
    }

    for (const skill of uniqueSkills(posting)) {
      current.skillCounts.set(skill, (current.skillCounts.get(skill) ?? 0) + 1);
    }
    groups.set(slug, current);
  }

  return Array.from(groups, ([slug, company]): CompanySearchResult => ({
    slug,
    name: company.name,
    href: `/companies/${encodeURIComponent(slug)}`,
    postingCount: company.postingCount,
    latestVerifiedAt: company.latestVerifiedAt,
    skillNames: Array.from(company.skillCounts)
      .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
      .slice(0, 5)
      .map(([name]) => name),
    sourceUrl: company.sourceUrl,
  })).sort(
    (left, right) =>
      right.postingCount - left.postingCount ||
      validTimestamp(right.latestVerifiedAt) -
        validTimestamp(left.latestVerifiedAt) ||
      left.name.localeCompare(right.name, "ko-KR"),
  );
}

function buildJobs(postings: PostingSummary[]): JobSearchResult[] {
  return postings.map((posting) => ({
    id: posting.id,
    title: posting.title,
    companyName: posting.company_name,
    companyHref: safeCompanyHref(posting.company_slug),
    href: `/jobs/${encodeURIComponent(posting.id)}`,
    sourceUrl: posting.source_url,
    careerType: posting.career_type,
    employmentType: posting.employment_type,
    location: posting.location,
    lastVerifiedAt: posting.last_verified_at,
    requiredSkills: posting.required_skills ?? [],
    preferredSkills: posting.preferred_skills ?? [],
    unspecifiedSkills: posting.unspecified_skills ?? [],
  }));
}

function skillRelevance(name: string, query: string) {
  const candidate = searchable(name);
  if (candidate === query) return 0;
  if (candidate.startsWith(query)) return 1;
  return 2;
}

function buildSkills(skillStats: SkillStatsResponse, query: string) {
  const normalizedQuery = searchable(query);
  return skillStats.items
    .filter((skill) => searchable(skill.skill).includes(normalizedQuery))
    .sort(
      (left, right) =>
        skillRelevance(left.skill, normalizedQuery) -
          skillRelevance(right.skill, normalizedQuery) ||
        right.count - left.count ||
        left.skill.localeCompare(right.skill, "ko-KR"),
    )
    .map(
      (skill): SkillSearchResult => ({
        name: skill.skill,
        category: skill.category,
        postingCount: skill.count,
        requiredCount: skill.required_count ?? null,
        preferredCount: skill.preferred_count ?? null,
        unspecifiedCount: skill.unspecified_count ?? null,
        skillHref: `/skill-map?skill=${encodeURIComponent(skill.skill)}`,
        jobsHref: `/jobs?q=${encodeURIComponent(skill.skill)}`,
      }),
    );
}

function communitySearchText(item: CommunityItem) {
  const shared = [
    item.category,
    item.authorName,
    item.authorHeadline,
    item.title,
    ...item.tags,
  ];
  if (item.type === "community_post") shared.push(item.body);
  else shared.push(item.summary, item.companyType, item.role, item.stage);
  return searchable(shared.join(" "));
}

function communityRelevance(item: CommunityItem, query: string) {
  const title = searchable(item.title);
  const tags = item.tags.map(searchable);
  if (title === query || tags.includes(query)) return 0;
  if (title.startsWith(query)) return 1;
  if (title.includes(query)) return 2;
  if (tags.some((tag) => tag.includes(query))) return 3;
  return 4;
}

function buildCommunity(items: CommunityItem[], query: string) {
  const normalizedQuery = searchable(query);
  return items
    .filter((item) => communitySearchText(item).includes(normalizedQuery))
    .sort(
      (left, right) =>
        communityRelevance(left, normalizedQuery) -
          communityRelevance(right, normalizedQuery) ||
        validTimestamp(right.createdAt) - validTimestamp(left.createdAt),
    )
    .map(
      (item): CommunitySearchResult => ({
        id: item.id,
        category: item.category,
        title: item.title,
        summary:
          item.type === "community_post" ? item.body : item.summary,
        tags: item.tags,
        href: item.href,
        authorName: item.authorName,
        authorHeadline: item.authorHeadline,
        createdLabel: item.createdLabel,
        source: item.source,
      }),
    );
}

export function mergeLocalCommunitySearchResults(
  snapshot: SearchSnapshot,
  localPosts: LocalCommunityPost[],
  now = new Date(),
): SearchSnapshot {
  if (!snapshot.query || localPosts.length === 0) return snapshot;

  const localResults = buildCommunity(
    localPosts.map((post) => localCommunityPostToFeedItem(post, now)),
    snapshot.query,
  );
  if (localResults.length === 0) return snapshot;

  const localIds = new Set(localResults.map((item) => item.id));
  const community = [
    ...localResults,
    ...snapshot.community.filter((item) => !localIds.has(item.id)),
  ];

  return {
    ...snapshot,
    community,
    counts: { ...snapshot.counts, community: community.length },
    hasAnyResults:
      snapshot.companies.length +
        snapshot.jobs.length +
        snapshot.skills.length +
        community.length >
      0,
  };
}

export function buildSearchSnapshot(input: {
  query: string;
  scope: SearchScope;
  postings: ResourceState<PostingListResponse> | null;
  skillStats: ResourceState<SkillStatsResponse> | null;
  communityItems: CommunityItem[];
}): SearchSnapshot {
  const query = normalizeSearchQuery(input.query);
  const scope = normalizeSearchScope(input.scope);

  if (!query) {
    return {
      query,
      scope,
      dataStatus: "idle",
      companies: [],
      jobs: [],
      skills: [],
      community: [],
      counts: { companies: null, jobs: null, skills: null, community: 0 },
      errors: [],
      hasAnyResults: false,
    };
  }

  const postingData =
    input.postings?.status === "ready" ? input.postings.data : null;
  const skillData =
    input.skillStats?.status === "ready" ? input.skillStats.data : null;
  const companies = postingData ? buildCompanies(postingData.items) : [];
  const jobs = postingData ? buildJobs(postingData.items) : [];
  const skills = skillData ? buildSkills(skillData, query) : [];
  const community = buildCommunity(input.communityItems, query);
  const errors = [
    input.postings?.status === "error" ? input.postings.message : null,
    input.skillStats?.status === "error" ? input.skillStats.message : null,
  ].filter((message): message is string => Boolean(message));
  const unavailableCount =
    Number(!input.postings || input.postings.status === "error") +
    Number(!input.skillStats || input.skillStats.status === "error");
  const dataStatus: SearchDataStatus =
    unavailableCount === 0
      ? "ready"
      : unavailableCount === 2
        ? "error"
        : "partial";
  const counts = {
    companies: postingData ? companies.length : null,
    jobs: postingData ? jobs.length : null,
    skills: skillData ? skills.length : null,
    community: community.length,
  };

  return {
    query,
    scope,
    dataStatus,
    companies,
    jobs,
    skills,
    community,
    counts,
    errors,
    hasAnyResults:
      companies.length + jobs.length + skills.length + community.length > 0,
  };
}
