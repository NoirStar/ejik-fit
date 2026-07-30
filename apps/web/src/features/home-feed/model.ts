import {
  careerConditionLabel,
  formatDomainLabel,
} from "@/features/career/model";
import {
  EMPTY_CAREER_PREFERENCES,
  normalizeCareerPreferences,
  type CareerPreferences,
} from "@/lib/career-preferences";
import { stableCompanyIdentity } from "@/lib/company-identity";
import {
  formatCareer,
  formatEmployment,
  formatLocation,
  PRODUCT_TERMS,
} from "@/lib/labels";
import {
  DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY,
  type LocalCommunityPost,
} from "@/lib/local-community-posts";
import { skillIdentityKey } from "@/lib/skill-catalog";
import type { CommunityPost } from "@/lib/community-contract";
import type {
  FitAnalyzeResponse,
  PostingListResponse,
  PostingSummary,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

import type { ResourceState } from "./resource-state";
import type {
  DataStatus,
  CareerContextSummary,
  CareerDirectionSummary,
  CareerInsightSummary,
  CommunityPostFeedItem,
  FeedItem,
  HomeFeedSnapshot,
  MarketInsightFeedItem,
  RecommendedJobFeedItem,
  SkillDemandSummary,
} from "./types";

function formatCommunityCreatedLabel(createdAt: string, now: Date) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "이 기기에서 작성";
  const elapsed = Math.max(0, now.getTime() - created.getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(created);
}

export function localCommunityPostToFeedItem(
  post: LocalCommunityPost,
  now = new Date(),
): CommunityPostFeedItem {
  return {
    id: post.id,
    type: "community_post",
    category: post.category ?? DEFAULT_LOCAL_COMMUNITY_POST_CATEGORY,
    authorId: "local-browser-user",
    authorName: "나",
    authorHeadline: "이 기기에서 작성",
    authorTone: "violet",
    createdAt: post.createdAt,
    createdLabel: formatCommunityCreatedLabel(post.createdAt, now),
    title: post.title,
    body: post.body,
    tags: post.tags,
    href: `/posts/${encodeURIComponent(post.id)}`,
    metrics: { reactions: 0, comments: 0, saves: 0 },
    source: "local",
  };
}

function serverAuthorTone(authorId: string): CommunityPostFeedItem["authorTone"] {
  const tones: CommunityPostFeedItem["authorTone"][] = [
    "violet",
    "blue",
    "green",
    "orange",
  ];
  const index = Array.from(authorId).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  return tones[index % tones.length];
}

export function serverCommunityPostToFeedItem(
  post: CommunityPost,
  now = new Date(),
): CommunityPostFeedItem {
  return {
    id: post.id,
    type: "community_post",
    category: post.category,
    authorId: post.author.id,
    authorName: post.author.nickname?.trim() || "커리어핏 사용자",
    authorHeadline: "커뮤니티 회원",
    authorTone: serverAuthorTone(post.author.id),
    createdAt: post.createdAt,
    createdLabel: formatCommunityCreatedLabel(post.createdAt, now),
    title: post.title,
    body: post.body,
    tags: post.tags,
    href: `/posts/${encodeURIComponent(post.id)}`,
    metrics: post.metrics,
    source: "server",
  };
}

export type BuildHomeFeedSnapshotInput = {
  postings: ResourceState<PostingListResponse>;
  skillStats: ResourceState<SkillStatsResponse>;
  graph?: ResourceState<SkillGraphResponse>;
  fit: ResourceState<FitAnalyzeResponse> | null;
  careerPreferences?: CareerPreferences;
  ownedSkills: string[];
  personalizationFallback?: boolean;
};

function readyData<T>(resource: ResourceState<T>): T | null {
  return resource.status === "ready" ? resource.data : null;
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function formatVerifiedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "확인 시각 미상";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(date);
}

function safeHostname(value: string) {
  try {
    return new URL(value).hostname.toLocaleLowerCase("en-US");
  } catch {
    return value;
  }
}

function latestVerifiedAt(values: string[]) {
  return values
    .filter((value) => !Number.isNaN(Date.parse(value)))
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0] ?? null;
}

function skillMatches(
  required: string[],
  preferred: string[],
  unspecified: string[],
  ownedSet: ReadonlySet<string>,
) {
  return {
    matchedRequiredSkills: required.filter((skill) =>
      ownedSet.has(skillIdentityKey(skill)),
    ),
    missingRequiredSkills: required.filter(
      (skill) => !ownedSet.has(skillIdentityKey(skill)),
    ),
    matchedPreferredSkills: preferred.filter((skill) =>
      ownedSet.has(skillIdentityKey(skill)),
    ),
    matchedUnspecifiedSkills: unspecified.filter((skill) =>
      ownedSet.has(skillIdentityKey(skill)),
    ),
  };
}

function recommendationReason(
  matches: ReturnType<typeof skillMatches>,
  hasOwnedSkills: boolean,
) {
  if (!hasOwnedSkills) return null;
  const matched = [
    ...matches.matchedRequiredSkills,
    ...matches.matchedPreferredSkills,
    ...matches.matchedUnspecifiedSkills,
  ];
  if (matched.length === 0) return "새로운 분야 탐색";
  if (matched.length > 1) return `내 기술 ${matched.length}개 일치`;
  const [skill] = matched;
  if (matches.matchedRequiredSkills.length > 0) {
    return `${skill} 필수 요건 일치`;
  }
  if (matches.matchedPreferredSkills.length > 0) {
    return `${skill} 우대 요건 일치`;
  }
  return `${skill} 기술 포함`;
}

export function postingSummaryToFeedItem(
  posting: PostingSummary,
  ownedSkills: string[],
): RecommendedJobFeedItem {
  const ownedSet = new Set(ownedSkills.map(skillIdentityKey));
  const required = posting.required_skills ?? [];
  const preferred = posting.preferred_skills ?? [];
  const unspecified = posting.unspecified_skills ?? [];
  const matches = skillMatches(required, preferred, unspecified, ownedSet);
  return {
    id: `job-${posting.id}`,
    postingId: posting.id,
    type: "recommended_job",
    companyName: posting.company_name,
    ...(posting.company_slug
      ? {
          companyHref: `/companies/${encodeURIComponent(posting.company_slug)}`,
          companySlug: posting.company_slug,
        }
      : {}),
    title: posting.title,
    location: formatLocation(posting.location),
    careerLabel: formatCareer(posting.career_type),
    employmentLabel: formatEmployment(posting.employment_type),
    sourceUrl: posting.source_url,
    firstSeenAt: posting.first_seen_at ?? null,
    verifiedLabel: formatVerifiedDate(posting.last_verified_at),
    requiredSkills: required,
    preferredSkills: preferred,
    unspecifiedSkills: unspecified,
    ...matches,
    recommendationReason: recommendationReason(matches, ownedSet.size > 0),
    href: `/jobs/${encodeURIComponent(posting.id)}`,
    source: "api",
  };
}

function buildJobs(
  postings: PostingListResponse | null,
  ownedSkills: string[],
): RecommendedJobFeedItem[] {
  return (postings?.items ?? []).map((posting) =>
    postingSummaryToFeedItem(posting, ownedSkills),
  );
}

function buildSkillDemand(skillStats: SkillStatsResponse | null): SkillDemandSummary[] {
  return (skillStats?.items ?? []).slice(0, 5).map((skill) => ({
    skillName: skill.skill,
    postingCount: skill.count,
    requiredCount: skill.required_count ?? 0,
    preferredCount: skill.preferred_count ?? 0,
    unspecifiedCount: skill.unspecified_count ?? 0,
  }));
}

function buildMarketInsights(
  skillDemand: SkillDemandSummary[],
): MarketInsightFeedItem[] {
  return skillDemand.slice(0, 2).map((skill) => ({
    id: `market-${skillIdentityKey(skill.skillName).replaceAll(" ", "-")}`,
    type: "market_insight",
    skillName: skill.skillName,
    title: `${skill.skillName} 요구 공고`,
    summary: `분석된 공고에서 필수 ${skill.requiredCount}건, 우대 ${skill.preferredCount}건, ${PRODUCT_TERMS.unspecifiedRequirement} ${skill.unspecifiedCount}건으로 확인됐습니다.`,
    postingCount: skill.postingCount,
    requiredCount: skill.requiredCount,
    preferredCount: skill.preferredCount,
    unspecifiedCount: skill.unspecifiedCount,
    sampleLabel: `기술 언급 공고 ${skill.postingCount}건`,
    sourceLabel: "공식 채용페이지 수집 데이터",
    href: `/career-map?skill=${encodeURIComponent(skill.skillName)}`,
    source: "api",
  }));
}

function buildCareerInsight(
  fit: ResourceState<FitAnalyzeResponse> | null,
  ownedSkills: string[],
): CareerInsightSummary {
  if (ownedSkills.length === 0) return { status: "needs_skills" };
  if (!fit || fit.status === "error") return { status: "unavailable" };

  const recommendation = [...fit.data.recommended_next_skills].sort(
    (left, right) =>
      right.required_count - left.required_count ||
      right.supporting_posting_count - left.supporting_posting_count ||
      left.skill.localeCompare(right.skill, "ko-KR"),
  )[0];

  return {
    status: "ready",
    matchingPostingCount: fit.data.coverage.matching_posting_count,
    strongFitPostingCount: fit.data.coverage.strong_fit_posting_count,
    nextSkill: recommendation
      ? {
          skillName: recommendation.skill,
          requiredCount: recommendation.required_count,
          preferredCount: recommendation.preferred_count,
          supportingPostingCount: recommendation.supporting_posting_count,
        }
      : null,
  };
}

function buildCareerContext(
  value: CareerPreferences | undefined,
): CareerContextSummary {
  const preferences = normalizeCareerPreferences(
    value ?? EMPTY_CAREER_PREFERENCES,
  );
  return {
    careerCondition: preferences.careerCondition,
    careerConditionLabel: preferences.careerCondition
      ? careerConditionLabel(preferences.careerCondition)
      : "전체 경력",
    targetDomain: preferences.targetDomain,
    targetDomainLabel: preferences.targetDomain
      ? formatDomainLabel(preferences.targetDomain)
      : "전체 기술 분야",
    configured: Boolean(
      preferences.careerCondition || preferences.targetDomain,
    ),
  };
}

function buildCareerDirections(
  fit: ResourceState<FitAnalyzeResponse> | null,
  graph: SkillGraphResponse | null,
  postings: PostingListResponse | null,
): CareerDirectionSummary[] {
  if (!fit || fit.status !== "ready") return [];

  const postingById = new Map(
    (postings?.items ?? []).map((posting) => [posting.id, posting]),
  );
  const skillsByDomain = new Map<string, Set<string>>();
  for (const node of graph?.nodes ?? []) {
    for (const domain of node.domains) {
      const skills = skillsByDomain.get(domain) ?? new Set<string>();
      skills.add(skillIdentityKey(node.id));
      skills.add(skillIdentityKey(node.label));
      skillsByDomain.set(domain, skills);
    }
  }

  return [...fit.data.domain_branches]
    .sort(
      (left, right) =>
        right.supporting_posting_count - left.supporting_posting_count ||
        left.domain.localeCompare(right.domain, "ko-KR"),
    )
    .slice(0, 5)
    .map((branch) => {
      const domainSkills = skillsByDomain.get(branch.domain) ?? new Set<string>();
      const branchSkills = new Set(
        [
          ...branch.covered_skills,
          ...branch.missing_required_skills,
          ...branch.missing_preferred_skills,
        ].map(skillIdentityKey),
      );
      const relevantEvidence = (graph?.evidence ?? []).filter((evidence) =>
        evidence.skills.some((skill) => {
          const key = skillIdentityKey(skill);
          return domainSkills.has(key) || branchSkills.has(key);
        }),
      );
      const representativeEvidence = relevantEvidence[0] ?? null;
      const representativePosting = representativeEvidence
        ? postingById.get(representativeEvidence.posting_id)
        : null;

      return {
        domain: branch.domain,
        label: formatDomainLabel(branch.domain),
        coveredSkills: branch.covered_skills,
        additionalRequirements: unique([
          ...branch.missing_required_skills,
          ...branch.missing_preferred_skills,
        ]),
        postingCount: branch.supporting_posting_count,
        confirmedCompanyCount: new Set(
          relevantEvidence.map((evidence) =>
            stableCompanyIdentity(
              postingById.get(evidence.posting_id),
              evidence.company_name,
            ),
          ),
        ).size,
        representativeJob: representativeEvidence
          ? {
              id: representativeEvidence.posting_id,
              title: representativePosting?.title ?? representativeEvidence.title,
              companyName:
                representativePosting?.company_name ?? representativeEvidence.company_name,
              href: `/jobs/${encodeURIComponent(representativeEvidence.posting_id)}`,
            }
          : null,
      };
    });
}

function mergeFeed(
  jobs: RecommendedJobFeedItem[],
  insights: MarketInsightFeedItem[],
): FeedItem[] {
  const ordered: FeedItem[] = [];
  const length = Math.max(jobs.length, insights.length);
  for (let index = 0; index < length; index += 1) {
    const job = jobs[index];
    const insight = insights[index];
    if (job) ordered.push(job);
    if (insight) ordered.push(insight);
  }
  return ordered;
}

function dataStatus(
  resources: Array<ResourceState<unknown>>,
  hasVerifiedData: boolean,
): DataStatus {
  const errors = resources.filter((resource) => resource.status === "error").length;
  if (errors === resources.length) return "error";
  if (errors > 0) return "partial";
  return hasVerifiedData ? "ready" : "empty";
}

export function buildHomeFeedSnapshot(
  input: BuildHomeFeedSnapshotInput,
): HomeFeedSnapshot {
  const postings = readyData(input.postings);
  const skillStats = readyData(input.skillStats);
  const graph = input.graph ? readyData(input.graph) : null;
  const requestedOwnedSkills = unique(
    input.ownedSkills.map((skill) => skill.trim()).filter(Boolean),
  );
  const canonicalOwnedSkills = postings?.canonical_owned_skills ?? [];
  const ownedSkills = unique(
    (canonicalOwnedSkills.length > 0
      ? canonicalOwnedSkills
      : requestedOwnedSkills
    ).map((skill) => skill.trim()).filter(Boolean),
  );
  const recommendedJobs = buildJobs(postings, ownedSkills);
  const skillDemand = buildSkillDemand(skillStats);
  const marketInsights = buildMarketInsights(skillDemand);
  const resources = [
    input.postings,
    input.skillStats,
    ...(input.graph ? [input.graph] : []),
    ...(input.fit ? [input.fit] : []),
  ];
  const resourceErrors = resources.flatMap(
    (resource) => resource.status === "error" ? [resource.message] : [],
  );
  const hasVerifiedData = recommendedJobs.length > 0
    || skillDemand.length > 0
    || input.fit?.status === "ready";

  return {
    dataStatus: dataStatus(
      resources,
      hasVerifiedData,
    ),
    feedItems: mergeFeed(recommendedJobs, marketInsights),
    recommendedJobs,
    marketInsights,
    skillDemand,
    careerInsight: buildCareerInsight(input.fit, ownedSkills),
    careerContext: buildCareerContext(input.careerPreferences),
    careerDirections: buildCareerDirections(input.fit, graph, postings),
    ownedSkills,
    personalizationFallback: input.personalizationFallback ?? false,
    postingCount: postings?.total ?? 0,
    sourceCount: new Set(
      (postings?.items ?? []).map((posting) => safeHostname(posting.source_url)),
    ).size,
    lastVerifiedAt: latestVerifiedAt(
      (postings?.items ?? []).map((posting) => posting.last_verified_at),
    ),
    resourceErrors,
    analysisPostings: postings?.items ?? [],
  };
}
