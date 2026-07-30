import type { CommunityCategory } from "@/lib/community-contract";
import type { PostingSummary } from "@/lib/types";

export type FeedTab = "recommended" | "following" | "latest" | "popular";
export type DataStatus = "ready" | "partial" | "empty" | "error";

export type SocialMetrics = {
  reactions: number;
  comments: number;
  saves: number;
};

export type AuthorTone = "violet" | "blue" | "green" | "orange";

export type CommunityPostFeedItem = {
  id: string;
  type: "community_post";
  category: CommunityCategory;
  authorId: string;
  authorName: string;
  authorHeadline: string;
  authorTone: AuthorTone;
  createdAt: string;
  createdLabel: string;
  title: string;
  body: string;
  tags: string[];
  href: string;
  metrics: SocialMetrics;
  source: "local" | "server";
};

export type MarketInsightFeedItem = {
  id: string;
  type: "market_insight";
  skillName: string;
  title: string;
  summary: string;
  postingCount: number;
  requiredCount: number;
  preferredCount: number;
  unspecifiedCount: number;
  sampleLabel: string;
  sourceLabel: string;
  href: string;
  source: "api";
};

export type RecommendedJobFeedItem = {
  id: string;
  postingId: string;
  type: "recommended_job";
  companyName: string;
  companyHref?: string;
  companySlug?: string;
  title: string;
  location: string;
  careerLabel: string;
  employmentLabel: string;
  sourceUrl: string;
  firstSeenAt: string | null;
  verifiedLabel: string;
  requiredSkills: string[];
  preferredSkills: string[];
  unspecifiedSkills: string[];
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedPreferredSkills: string[];
  matchedUnspecifiedSkills: string[];
  recommendationReason: string | null;
  href: string;
  source: "api";
};

export type SkillDemandSummary = {
  skillName: string;
  postingCount: number;
  requiredCount: number;
  preferredCount: number;
  unspecifiedCount: number;
};

export type CareerInsightSummary =
  | { status: "needs_skills" }
  | { status: "unavailable" }
  | {
      status: "ready";
      matchingPostingCount: number;
      strongFitPostingCount: number;
      nextSkill: {
        skillName: string;
        requiredCount: number;
        preferredCount: number;
        supportingPostingCount: number;
      } | null;
    };

export type CareerContextSummary = {
  careerCondition: "" | "new_comer" | "experienced" | "mixed";
  careerConditionLabel: string;
  targetDomain: string;
  targetDomainLabel: string;
  configured: boolean;
};

export type CareerDirectionSummary = {
  domain: string;
  label: string;
  coveredSkills: string[];
  additionalRequirements: string[];
  postingCount: number;
  confirmedCompanyCount: number;
  representativeJob: {
    id: string;
    title: string;
    companyName: string;
    href: string;
  } | null;
};

export type FeedItem =
  | CommunityPostFeedItem
  | MarketInsightFeedItem
  | RecommendedJobFeedItem;

export type HomeFeedSnapshot = {
  dataStatus: DataStatus;
  feedItems: FeedItem[];
  recommendedJobs: RecommendedJobFeedItem[];
  marketInsights: MarketInsightFeedItem[];
  skillDemand: SkillDemandSummary[];
  careerInsight: CareerInsightSummary;
  careerContext: CareerContextSummary;
  careerDirections: CareerDirectionSummary[];
  ownedSkills: string[];
  personalizationFallback: boolean;
  postingCount: number;
  sourceCount: number;
  lastVerifiedAt: string | null;
  resourceErrors: string[];
  /** Canonical posting sample used by every career-analysis surface. */
  analysisPostings?: PostingSummary[];
};
