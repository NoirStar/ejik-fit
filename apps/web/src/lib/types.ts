export type PostingSummary = {
  id: string;
  title: string;
  company_name: string;
  career_type: string | null;
  employment_type: string | null;
  career_min: number | null;
  career_max: number | null;
  location: string | null;
  status: string;
  source_url: string;
  last_verified_at: string;
};

export type PostingDetail = PostingSummary & {
  description_html: string;
  description_text: string;
  opens_at: string | null;
  closes_at: string | null;
  skills: string[];
};

export type PostingListResponse = {
  items: PostingSummary[];
  total: number;
};

export type SkillStat = {
  skill: string;
  category: string;
  count: number;
};

export type SkillStatsResponse = {
  items: SkillStat[];
  total: number;
};
