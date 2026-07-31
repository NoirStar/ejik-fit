import type {
  CareerAnalyzeRequest,
  CareerAnalyzeResponse,
  FitAnalyzeRequest,
  FitAnalyzeResponse,
  HiringOverviewResponse,
  MarketCareerFieldsResponse,
  PostingDetail,
  PostingListResponse,
  SkillCatalogResponse,
  SkillGraphResponse,
  SkillGraphEvidenceResponse,
  SkillStatsResponse,
  SkillTrendResponse,
  SourceDirectoryResponse,
} from "./types";
import { normalizeHiringOverview } from "./hiring-contract";
import {
  normalizePostingDetail,
  normalizePostingList,
} from "./posting-contract";
import {
  ApiError,
  ApiTimeoutError,
  requestJson,
  type RequestPolicy,
} from "./api-request";

export { ApiError, ApiTimeoutError };

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:8000";

const CAREER_ANALYSIS_TIMEOUT_MS = 30_000;

export const SKILL_GRAPH_MAX_LIMIT = 60;

async function request<T>(
  path: string,
  options: RequestInit & {
    policy?: RequestPolicy;
    tags?: string[];
    timeoutMs?: number;
  } = {},
): Promise<T> {
  const { policy = "public", tags = [], timeoutMs, ...init } = options;
  return requestJson<T>(API_BASE_URL, path, {
    ...init,
    policy,
    tags,
    timeoutMs,
  });
}

export async function getPostings(filters: {
  q?: string;
  career_type?: string;
  category?: string;
  company?: string;
  companies?: string[];
  owned_skills?: string[];
  limit?: number;
  offset?: number;
} = {}): Promise<PostingListResponse> {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.career_type) {
    params.set("career_type", filters.career_type);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.company) {
    params.set("company", filters.company);
  }
  for (const company of filters.companies ?? []) {
    params.append("companies", company);
  }
  for (const skill of filters.owned_skills ?? []) {
    params.append("owned_skills", skill);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  if (filters.offset) {
    params.set("offset", String(filters.offset));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return normalizePostingList(
    await request<unknown>(`/api/postings${query}`, {
      policy: filters.owned_skills?.length ? "private" : "public",
      tags: ["postings"],
    }),
  );
}

export function analyzeCareer(
  input: CareerAnalyzeRequest,
): Promise<CareerAnalyzeResponse> {
  return request<CareerAnalyzeResponse>("/api/career/analyze", {
    method: "POST",
    body: JSON.stringify(input),
    headers: { "Content-Type": "application/json" },
    policy: "private",
    tags: ["career-analysis"],
    timeoutMs: CAREER_ANALYSIS_TIMEOUT_MS,
  });
}

export function getMarketCareerFields(filters: {
  career_type?: string;
  category?: string;
} = {}): Promise<MarketCareerFieldsResponse> {
  const params = new URLSearchParams();
  if (filters.career_type) params.set("career_type", filters.career_type);
  if (filters.category) params.set("category", filters.category);
  const query = params.toString();
  return request<MarketCareerFieldsResponse>(
    `/api/career/market${query ? `?${query}` : ""}`,
    { policy: "public", tags: ["career-market"] },
  );
}

export async function getPosting(
  id: string,
  signal?: AbortSignal,
): Promise<PostingDetail> {
  return normalizePostingDetail(
    await request<unknown>(`/api/postings/${encodeURIComponent(id)}`, {
      policy: "public",
      signal,
      tags: ["postings"],
    }),
  );
}

export async function getHiringOverview(filters: {
  start: string;
  end: string;
  activityDays?: number;
  limit?: number;
}): Promise<HiringOverviewResponse> {
  const params = new URLSearchParams({
    start: filters.start,
    end: filters.end,
  });
  if (filters.activityDays) {
    params.set("activity_days", String(filters.activityDays));
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  return normalizeHiringOverview(
    await request<unknown>(`/api/hiring/overview?${params.toString()}`, {
      policy: "public",
      tags: ["hiring"],
    }),
  );
}

export function getSkillStats(filters: {
  career_type?: string;
  category?: string;
  limit?: number;
} = {}): Promise<SkillStatsResponse> {
  const params = new URLSearchParams();
  if (filters.career_type) {
    params.set("career_type", filters.career_type);
  }
  if (filters.category) {
    params.set("category", filters.category);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request<SkillStatsResponse>(`/api/skills/stats${query}`, {
    policy: "public",
    tags: ["skills"],
  });
}

export function getSkillCatalog(): Promise<SkillCatalogResponse> {
  return request<SkillCatalogResponse>("/api/skills/catalog", {
    policy: "durable",
    tags: ["skill-catalog"],
  });
}

export function getSkillTrends(
  skills: string[],
  weeks = 12,
): Promise<SkillTrendResponse> {
  const params = new URLSearchParams({ weeks: String(weeks) });
  for (const skill of skills.slice(0, 3)) {
    params.append("skills", skill);
  }
  return request<SkillTrendResponse>(
    `/api/skills/trends?${params.toString()}`,
    {
      policy: "public",
      tags: ["skill-trends"],
    },
  );
}

export function getSourceDirectory(): Promise<SourceDirectoryResponse> {
  return request<SourceDirectoryResponse>("/api/sources", {
    policy: "durable",
    tags: ["sources"],
  });
}

export function getSkillGraph(filters: {
  seed?: string;
  owned_skills?: string[];
  career_type?: string;
  depth?: 1 | 2;
  limit?: number;
  include_evidence?: boolean;
} = {}): Promise<SkillGraphResponse> {
  if (
    filters.limit !== undefined &&
    (filters.limit < 5 || filters.limit > SKILL_GRAPH_MAX_LIMIT)
  ) {
    throw new RangeError(
      `기술 관계 요청 limit은 5~${SKILL_GRAPH_MAX_LIMIT} 범위여야 합니다.`,
    );
  }
  const params = new URLSearchParams();
  if (filters.seed) {
    params.set("seed", filters.seed);
  }
  for (const skill of filters.owned_skills ?? []) {
    params.append("owned_skills", skill);
  }
  if (filters.career_type) {
    params.set("career_type", filters.career_type);
  }
  if (filters.depth) {
    params.set("depth", String(filters.depth));
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  if (filters.include_evidence !== undefined) {
    params.set("include_evidence", String(filters.include_evidence));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request<SkillGraphResponse>(`/api/graph/skills${query}`, {
    policy: "public",
    tags: ["skill-graph"],
  });
}

export function getSkillGraphEvidence(
  filters: {
    skill: string;
    career_type?: string;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<SkillGraphEvidenceResponse> {
  const params = new URLSearchParams({ skill: filters.skill });
  if (filters.career_type) {
    params.set("career_type", filters.career_type);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  return request<SkillGraphEvidenceResponse>(
    `/api/graph/skills/evidence?${params.toString()}`,
    {
      policy: "public",
      signal,
      tags: ["skill-graph-evidence"],
    },
  );
}

export function analyzeFit(
  payload: FitAnalyzeRequest,
  signal?: AbortSignal,
): Promise<FitAnalyzeResponse> {
  return request<FitAnalyzeResponse>("/api/fit/analyze", {
    method: "POST",
    policy: "private",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}
