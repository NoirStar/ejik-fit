import type {
  FitAnalyzeRequest,
  FitAnalyzeResponse,
  HiringOverviewResponse,
  PostingDetail,
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
  SkillTrendResponse,
  SourceDirectoryResponse,
} from "./types";
import { normalizeHiringOverview } from "./hiring-contract";
import {
  normalizePostingDetail,
  normalizePostingList,
} from "./posting-contract";

const API_BASE_URL =
  process.env.API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  constructor(
    public readonly url: string,
    public readonly status: number,
  ) {
    super(`API request failed: ${url} (${status})`);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const url = new URL(path, API_BASE_URL);
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new ApiError(url.toString(), response.status);
  }
  return response.json() as Promise<T>;
}

export async function getPostings(filters: {
  q?: string;
  career_type?: string;
  category?: string;
  company?: string;
  companies?: string[];
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
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  if (filters.offset) {
    params.set("offset", String(filters.offset));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return normalizePostingList(
    await request<unknown>(`/api/postings${query}`),
  );
}

export async function getPosting(
  id: string,
  signal?: AbortSignal,
): Promise<PostingDetail> {
  return normalizePostingDetail(
    await request<unknown>(`/api/postings/${encodeURIComponent(id)}`, {
      signal,
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
    await request<unknown>(`/api/hiring/overview?${params.toString()}`),
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
  return request<SkillStatsResponse>(`/api/skills/stats${query}`);
}

export function getSkillTrends(
  skills: string[],
  weeks = 12,
): Promise<SkillTrendResponse> {
  const params = new URLSearchParams({ weeks: String(weeks) });
  for (const skill of skills.slice(0, 3)) {
    params.append("skills", skill);
  }
  return request<SkillTrendResponse>(`/api/skills/trends?${params.toString()}`);
}

export function getSourceDirectory(): Promise<SourceDirectoryResponse> {
  return request<SourceDirectoryResponse>("/api/sources");
}

export function getSkillGraph(filters: {
  seed?: string;
  owned_skills?: string[];
  career_type?: string;
  limit?: number;
} = {}): Promise<SkillGraphResponse> {
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
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request<SkillGraphResponse>(`/api/graph/skills${query}`);
}

export function analyzeFit(
  payload: FitAnalyzeRequest,
  signal?: AbortSignal,
): Promise<FitAnalyzeResponse> {
  return request<FitAnalyzeResponse>("/api/fit/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });
}
