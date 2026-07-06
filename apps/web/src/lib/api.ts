import type {
  FitAnalyzeRequest,
  FitAnalyzeResponse,
  PostingDetail,
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "./types";


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
}): Promise<PostingListResponse> {
  const params = new URLSearchParams();
  if (filters.q) {
    params.set("q", filters.q);
  }
  if (filters.career_type) {
    params.set("career_type", filters.career_type);
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request<PostingListResponse>(`/api/postings${query}`);
}


export function getPosting(id: string): Promise<PostingDetail> {
  return request<PostingDetail>(
    `/api/postings/${encodeURIComponent(id)}`,
  );
}


export function getSkillStats(filters: {
  career_type?: string;
  limit?: number;
} = {}): Promise<SkillStatsResponse> {
  const params = new URLSearchParams();
  if (filters.career_type) {
    params.set("career_type", filters.career_type);
  }
  if (filters.limit) {
    params.set("limit", String(filters.limit));
  }
  const query = params.size > 0 ? `?${params.toString()}` : "";
  return request<SkillStatsResponse>(`/api/skills/stats${query}`);
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
): Promise<FitAnalyzeResponse> {
  return request<FitAnalyzeResponse>("/api/fit/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}
