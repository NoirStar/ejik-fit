export type PostingSummary = {
  id: string;
  title: string;
  company_name: string;
  company_slug?: string;
  career_type: string | null;
  employment_type: string | null;
  career_min: number | null;
  career_max: number | null;
  location: string | null;
  status: string;
  source_url: string;
  last_verified_at: string;
  opens_at?: string | null;
  closes_at?: string | null;
  required_skills?: string[];
  preferred_skills?: string[];
  unspecified_skills?: string[];
};

export type SkillDetail = {
  skill: string;
  category: string;
  requirement_type: "required" | "preferred" | "unspecified";
  evidence_text: string | null;
  confidence: number;
  match_reason: string;
};

export type PostingDetail = PostingSummary & {
  description_html: string;
  description_text: string;
  opens_at: string | null;
  closes_at: string | null;
  skills: string[];
  skill_details?: SkillDetail[];
};

export type PostingListResponse = {
  items: PostingSummary[];
  total: number;
};

export type SkillStat = {
  skill: string;
  category: string;
  count: number;
  required_count?: number;
  preferred_count?: number;
  unspecified_count?: number;
};

export type SkillStatsResponse = {
  items: SkillStat[];
  total: number;
};

export type SkillGraphNode = {
  id: string;
  label: string;
  category: string;
  kind: string;
  domains: string[];
  demand_count: number;
  required_count: number;
  preferred_count: number;
  unspecified_count: number;
  owned: boolean;
  seed: boolean;
};

export type SkillGraphEdge = {
  id: string;
  source: string;
  target: string;
  score: number;
  cooccurrence_count: number;
  required_pair_count: number;
  supporting_posting_ids: string[];
};

export type SkillGraphEvidence = {
  posting_id: string;
  title: string;
  company_name: string;
  skills: string[];
  required: string[];
  preferred: string[];
  unspecified: string[];
};

export type SkillGraphResponse = {
  seed: string | null;
  nodes: SkillGraphNode[];
  edges: SkillGraphEdge[];
  evidence: SkillGraphEvidence[];
  meta: {
    limit: number;
    min_confidence: number;
  };
};

export type FitAnalyzeRequest = {
  owned_skills: string[];
  career_type?: string;
  domains?: string[];
};

export type FitAnalyzeResponse = {
  coverage: {
    matching_posting_count: number;
    strong_fit_posting_count: number;
  };
  domain_branches: Array<{
    domain: string;
    covered_skills: string[];
    missing_required_skills: string[];
    missing_preferred_skills: string[];
    supporting_posting_count: number;
  }>;
  recommended_next_skills: Array<{
    skill: string;
    reason: string;
    required_count: number;
    preferred_count: number;
    supporting_posting_count: number;
  }>;
};
