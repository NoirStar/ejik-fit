import {
  careerConditionLabel,
  formatDomainLabel,
} from "@/features/career/model";
import {
  EMPTY_CAREER_PREFERENCES,
  normalizeCareerPreferences,
  type CareerPreferences,
} from "@/lib/career-preferences";
import { formatCareer, formatEmployment } from "@/lib/labels";
import type { LocalCommunityPost } from "@/lib/local-community-posts";
import type {
  FitAnalyzeResponse,
  PostingListResponse,
  SkillGraphEvidence,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

import {
  MOCK_COMMUNITY_POSTS,
  MOCK_INTERVIEW_REVIEWS,
  MOCK_SOCIAL_ITEMS,
} from "./mock-community";
import type { ResourceState } from "./resource-state";
import type {
  DataStatus,
  CareerContextSummary,
  CareerInsightSummary,
  CommunityPostFeedItem,
  FeedItem,
  HomeFeedSnapshot,
  MarketInsightFeedItem,
  RecommendedJobFeedItem,
  SkillDemandSummary,
} from "./types";

function formatLocalPostCreatedLabel(createdAt: string, now: Date) {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return "이 브라우저에서 작성";
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
    category: "업무 이야기",
    authorId: "local-browser-user",
    authorName: "나",
    authorHeadline: "이 브라우저에서 작성",
    authorTone: "violet",
    createdAt: post.createdAt,
    createdLabel: formatLocalPostCreatedLabel(post.createdAt, now),
    title: post.title,
    body: post.body,
    tags: post.tags,
    href: `/posts/${encodeURIComponent(post.id)}`,
    metrics: { reactions: 0, comments: 0, saves: 0 },
    source: "local",
  };
}

export type BuildHomeFeedSnapshotInput = {
  postings: ResourceState<PostingListResponse>;
  skillStats: ResourceState<SkillStatsResponse>;
  graph: ResourceState<SkillGraphResponse>;
  fit: ResourceState<FitAnalyzeResponse> | null;
  careerPreferences?: CareerPreferences;
  ownedSkills: string[];
};

function readyData<T>(resource: ResourceState<T>): T | null {
  return resource.status === "ready" ? resource.data : null;
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
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

function evidenceByPostingId(graph: SkillGraphResponse | null) {
  return new Map(
    (graph?.evidence ?? []).map((evidence) => [evidence.posting_id, evidence]),
  );
}

function skillMatches(
  evidence: SkillGraphEvidence | undefined,
  ownedSet: ReadonlySet<string>,
) {
  if (!evidence) {
    return {
      matchedRequiredSkills: [],
      missingRequiredSkills: [],
      matchedPreferredSkills: [],
    };
  }
  return {
    matchedRequiredSkills: evidence.required.filter((skill) => ownedSet.has(normalize(skill))),
    missingRequiredSkills: evidence.required.filter((skill) => !ownedSet.has(normalize(skill))),
    matchedPreferredSkills: evidence.preferred.filter((skill) => ownedSet.has(normalize(skill))),
  };
}

function postingFitScore(
  evidence: SkillGraphEvidence | undefined,
  ownedSet: ReadonlySet<string>,
) {
  if (!evidence || ownedSet.size === 0) return null;
  const matchedRequired = evidence.required.filter((skill) =>
    ownedSet.has(normalize(skill)),
  ).length;
  const matchedPreferred = evidence.preferred.filter((skill) =>
    ownedSet.has(normalize(skill)),
  ).length;
  const matchedUnspecified = evidence.unspecified.filter((skill) =>
    ownedSet.has(normalize(skill)),
  ).length;
  const matchedTotal = matchedRequired + matchedPreferred + matchedUnspecified;
  if (matchedTotal === 0) return null;

  const missingRequired = evidence.required.length - matchedRequired;
  const requiredCoverage = evidence.required.length > 0
    ? matchedRequired / evidence.required.length
    : 0;
  return (
    matchedRequired * 120
    + matchedPreferred * 45
    + matchedUnspecified * 20
    + requiredCoverage * 35
    - missingRequired * 12
  );
}

function buildJobs(
  postings: PostingListResponse | null,
  graph: SkillGraphResponse | null,
  ownedSkills: string[],
): RecommendedJobFeedItem[] {
  const evidenceMap = evidenceByPostingId(graph);
  const ownedSet = new Set(ownedSkills.map(normalize));
  const rankedPostings = (postings?.items ?? [])
    .map((posting, index) => ({
      index,
      posting,
      score: postingFitScore(evidenceMap.get(posting.id), ownedSet),
    }))
    .sort((left, right) => {
      if (left.score === null && right.score === null) {
        return left.index - right.index;
      }
      if (left.score === null) return 1;
      if (right.score === null) return -1;
      return right.score - left.score || left.index - right.index;
    })
    .slice(0, 2)
    .map(({ posting }) => posting);

  return rankedPostings.map((posting) => ({
    id: `job-${posting.id}`,
    postingId: posting.id,
    type: "recommended_job",
    companyName: posting.company_name,
    ...(posting.company_slug
      ? {
          companyHref: `/companies/${encodeURIComponent(posting.company_slug)}`,
        }
      : {}),
    title: posting.title,
    location: posting.location ?? "근무지 미기재",
    careerLabel: formatCareer(posting.career_type),
    employmentLabel: formatEmployment(posting.employment_type),
    sourceUrl: posting.source_url,
    verifiedLabel: formatVerifiedDate(posting.last_verified_at),
    ...skillMatches(evidenceMap.get(posting.id), ownedSet),
    href: `/jobs/${encodeURIComponent(posting.id)}`,
    source: "api",
  }));
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
    id: `market-${normalize(skill.skillName).replaceAll(" ", "-")}`,
    type: "market_insight",
    skillName: skill.skillName,
    title: `${skill.skillName}을 요구하는 공식 공고를 확인했어요`,
    summary: `분석된 공고에서 필수 ${skill.requiredCount}건, 우대 ${skill.preferredCount}건, 미분류 ${skill.unspecifiedCount}건으로 확인됐습니다.`,
    postingCount: skill.postingCount,
    requiredCount: skill.requiredCount,
    preferredCount: skill.preferredCount,
    unspecifiedCount: skill.unspecifiedCount,
    sampleLabel: `기술 언급 공고 ${skill.postingCount}건`,
    sourceLabel: "공식 채용페이지 수집 데이터",
    href: `/skill-map?skill=${encodeURIComponent(skill.skillName)}`,
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

function mergeFeed(
  jobs: RecommendedJobFeedItem[],
  insights: MarketInsightFeedItem[],
): FeedItem[] {
  const ordered: Array<FeedItem | undefined> = [
    MOCK_COMMUNITY_POSTS[0],
    jobs[0],
    MOCK_INTERVIEW_REVIEWS[0],
    insights[0],
    MOCK_COMMUNITY_POSTS[1],
    jobs[1],
    insights[1],
    ...MOCK_SOCIAL_ITEMS.slice(3),
  ];
  return ordered.filter((item): item is FeedItem => Boolean(item));
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
  const graph = readyData(input.graph);
  const ownedSkills = unique(input.ownedSkills.map((skill) => skill.trim()).filter(Boolean));
  const recommendedJobs = buildJobs(postings, graph, ownedSkills);
  const skillDemand = buildSkillDemand(skillStats);
  const marketInsights = buildMarketInsights(skillDemand);
  const resources = [
    input.postings,
    input.skillStats,
    input.graph,
    ...(input.fit ? [input.fit] : []),
  ];
  const resourceErrors = resources.flatMap(
    (resource) => resource.status === "error" ? [resource.message] : [],
  );
  const hasVerifiedData = recommendedJobs.length > 0
    || skillDemand.length > 0
    || (graph?.evidence.length ?? 0) > 0
    || input.fit?.status === "ready";

  return {
    dataStatus: dataStatus(
      resources,
      hasVerifiedData,
    ),
    feedItems: mergeFeed(recommendedJobs, marketInsights),
    communityItems: MOCK_SOCIAL_ITEMS,
    recommendedJobs,
    marketInsights,
    skillDemand,
    careerInsight: buildCareerInsight(input.fit, ownedSkills),
    careerContext: buildCareerContext(input.careerPreferences),
    ownedSkills,
    postingCount: postings?.items.length ?? 0,
    sourceCount: new Set(
      (postings?.items ?? []).map((posting) => safeHostname(posting.source_url)),
    ).size,
    lastVerifiedAt: latestVerifiedAt(
      (postings?.items ?? []).map((posting) => posting.last_verified_at),
    ),
    resourceErrors,
  };
}
