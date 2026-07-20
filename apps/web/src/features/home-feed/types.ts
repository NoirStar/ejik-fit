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
  category: "이직 고민" | "커리어 질문" | "업무 이야기";
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
  source: "mock" | "local";
};

export type InterviewReviewFeedItem = {
  id: string;
  type: "interview_review";
  category: "면접 후기";
  authorId: string;
  authorName: string;
  authorHeadline: string;
  authorTone: AuthorTone;
  createdAt: string;
  createdLabel: string;
  companyType: string;
  role: string;
  stage: string;
  title: string;
  summary: string;
  tags: string[];
  href: string;
  metrics: SocialMetrics;
  source: "mock";
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
  title: string;
  location: string;
  careerLabel: string;
  employmentLabel: string;
  sourceUrl: string;
  verifiedLabel: string;
  matchedRequiredSkills: string[];
  missingRequiredSkills: string[];
  matchedPreferredSkills: string[];
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

export type FeedItem =
  | CommunityPostFeedItem
  | InterviewReviewFeedItem
  | MarketInsightFeedItem
  | RecommendedJobFeedItem;

export type HomeFeedSnapshot = {
  dataStatus: DataStatus;
  feedItems: FeedItem[];
  communityItems: Array<CommunityPostFeedItem | InterviewReviewFeedItem>;
  recommendedJobs: RecommendedJobFeedItem[];
  marketInsights: MarketInsightFeedItem[];
  skillDemand: SkillDemandSummary[];
  careerInsight: CareerInsightSummary;
  careerContext: CareerContextSummary;
  ownedSkills: string[];
  postingCount: number;
  sourceCount: number;
  lastVerifiedAt: string | null;
  resourceErrors: string[];
};
