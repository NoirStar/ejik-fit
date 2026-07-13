import type { Metadata } from "next";

import { JobList } from "@/features/jobs/job-list";
import { getPostings } from "@/lib/api";
import type {
  PostingListResponse,
  PostingSummary,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "공고 탐색",
  description: "한국 기술기업의 공식 채용페이지에서 확인한 개발 직군 공고를 검색합니다.",
};

type SearchParams = Record<string, string | string[] | undefined>;

const SUPPORTED_CAREER_TYPES = new Set(["new_comer", "experienced", "mixed"]);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(
  record: Record<string, unknown>,
  key: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return value;
}

function nullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return value;
}

function nullableYear(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return Number(value);
}

function optionalStrings(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid posting field: ${key}`);
  }
  return value;
}

function normalizePosting(value: unknown): PostingSummary {
  if (!isRecord(value)) throw new Error("Invalid posting item");

  return {
    id: requiredString(value, "id"),
    title: requiredString(value, "title"),
    company_name: requiredString(value, "company_name"),
    career_type: nullableString(value, "career_type"),
    employment_type: nullableString(value, "employment_type"),
    career_min: nullableYear(value, "career_min"),
    career_max: nullableYear(value, "career_max"),
    location: nullableString(value, "location"),
    status: requiredString(value, "status"),
    source_url: requiredString(value, "source_url"),
    last_verified_at: requiredString(value, "last_verified_at"),
    opens_at: nullableString(value, "opens_at"),
    closes_at: nullableString(value, "closes_at"),
    required_skills: optionalStrings(value, "required_skills"),
    preferred_skills: optionalStrings(value, "preferred_skills"),
    unspecified_skills: optionalStrings(value, "unspecified_skills"),
  };
}

function normalizePostingList(value: unknown): PostingListResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new Error("Invalid posting list response");
  }
  if (!Number.isSafeInteger(value.total) || Number(value.total) < 0) {
    throw new Error("Invalid posting total");
  }
  return {
    items: value.items.map(normalizePosting),
    total: Number(value.total),
  };
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
} = {}) {
  const params = searchParams ? await searchParams : {};
  const query = first(params.q).trim();
  const requestedCareerType = first(params.career_type);
  const careerType = SUPPORTED_CAREER_TYPES.has(requestedCareerType)
    ? requestedCareerType
    : "";

  try {
    const postings = normalizePostingList(
      await getPostings({
        ...(query ? { q: query } : {}),
        ...(careerType ? { career_type: careerType } : {}),
        limit: 100,
      }),
    );
    return (
      <JobList
        filters={{ query, careerType }}
        postings={postings}
      />
    );
  } catch (error) {
    console.error("[jobs] request failed", error);
    return (
      <JobList
        error
        filters={{ query, careerType }}
        postings={null}
      />
    );
  }
}
