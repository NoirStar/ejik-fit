import type {
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";


export type DashboardMode = "personalized" | "supplemented" | "empty";


export type DashboardJob = {
  id: string;
  title: string;
  companyName: string;
  location: string;
  careerLabel: string;
  statusLabel: string;
  freshnessLabel: string;
  sourceUrl: string | null;
  fitScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  recommendationReasons: string[];
  isSupplemental: boolean;
};


export type DashboardSummary = {
  matchedJobCount: number;
  highFitJobCount: number;
  gapSkillCount: number;
  actionItemCount: number;
};


export type MarketSignal = {
  label: string;
  value: string;
  caption: string;
};


export type DailyDashboardModel = {
  mode: DashboardMode;
  ownedSkills: string[];
  jobs: DashboardJob[];
  summary: DashboardSummary;
  trendingSkills: MarketSignal[];
  cooccurringSkills: MarketSignal[];
  updatedLabel: string;
};


export type DailyDashboardInput = {
  postings: PostingListResponse | null;
  graph: SkillGraphResponse | null;
  skillStats: SkillStatsResponse | null;
  ownedSkills: string[];
  now?: Date;
};
