import { NextResponse } from "next/server";

import { getPostings } from "@/lib/api";
import {
  SKILL_CATEGORIES,
  type SkillCategory,
} from "@/lib/skill-categories";
import type { SavedJobSearchCareerType } from "@/lib/saved-job-searches";
import type { SavedSearchEvaluationGroup } from "@/lib/saved-search-notifications";

const MAX_SEARCHES = 10;
const MAX_ID_LENGTH = 100;
const MAX_QUERY_LENGTH = 200;
const MAX_FUTURE_CHECKPOINT_MS = 5 * 60 * 1_000;
const INVALID_REQUEST_ERROR = "유효한 저장 검색 조건이 필요합니다.";
const ISO_DATE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const SUPPORTED_CATEGORIES = new Set<string>(
  SKILL_CATEGORIES.map((category) => category.value),
);
const SUPPORTED_CAREER_TYPES = new Set<string>([
  "",
  "new_comer",
  "experienced",
  "mixed",
] satisfies SavedJobSearchCareerType[]);

export type SavedSearchEvaluationRequest = {
  searches: Array<{
    id: string;
    query: string;
    category: string;
    careerType: string;
    lastCheckedAt: string;
  }>;
};

type NormalizedSearch = {
  id: string;
  query: string;
  category: SkillCategory;
  careerType: SavedJobSearchCareerType;
  checkpoint: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) {
    const leapYear =
      year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leapYear ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseIsoDate(value: unknown, now: number) {
  if (typeof value !== "string") return null;
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] =
    match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed) ||
    parsed > now + MAX_FUTURE_CHECKPOINT_MS
  ) {
    return null;
  }
  return parsed;
}

function normalizedSearches(value: unknown): NormalizedSearch[] {
  if (!isRecord(value) || !Array.isArray(value.searches)) {
    throw new TypeError("Invalid saved search evaluation request");
  }
  if (value.searches.length < 1 || value.searches.length > MAX_SEARCHES) {
    throw new TypeError("Invalid saved search count");
  }

  const now = Date.now();
  const ids = new Set<string>();
  return value.searches.map((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== "string" ||
      candidate.id.length > MAX_ID_LENGTH ||
      typeof candidate.query !== "string" ||
      candidate.query.length > MAX_QUERY_LENGTH ||
      typeof candidate.category !== "string" ||
      !SUPPORTED_CATEGORIES.has(candidate.category) ||
      typeof candidate.careerType !== "string" ||
      !SUPPORTED_CAREER_TYPES.has(candidate.careerType)
    ) {
      throw new TypeError("Invalid saved search");
    }

    const id = candidate.id.trim();
    const query = candidate.query.trim().replace(/\s+/g, " ");
    const checkpoint = parseIsoDate(candidate.lastCheckedAt, now);
    if (
      !id ||
      id.length > MAX_ID_LENGTH ||
      ids.has(id) ||
      checkpoint === null ||
      (!query && !candidate.category && !candidate.careerType)
    ) {
      throw new TypeError("Invalid saved search");
    }
    ids.add(id);
    return {
      id,
      query,
      category: candidate.category as SkillCategory,
      careerType: candidate.careerType as SavedJobSearchCareerType,
      checkpoint,
    };
  });
}

function invalidRequestResponse() {
  return NextResponse.json(
    { error: INVALID_REQUEST_ERROR },
    {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  let searches: NormalizedSearch[];
  try {
    searches = normalizedSearches(await request.json());
  } catch {
    return invalidRequestResponse();
  }

  const evaluatedAt = new Date().toISOString();
  const settled = await Promise.allSettled(
    searches.map(async (search): Promise<SavedSearchEvaluationGroup> => {
      const postings = await getPostings({
        ...(search.query ? { q: search.query } : {}),
        ...(search.category ? { category: search.category } : {}),
        ...(search.careerType
          ? { career_type: search.careerType }
          : {}),
        limit: 20,
      });
      const items = postings.items
        .filter((posting) => {
          const discoveredAt = posting.first_seen_at
            ? Date.parse(posting.first_seen_at)
            : Number.NaN;
          return (
            Number.isFinite(discoveredAt) &&
            discoveredAt > search.checkpoint
          );
        })
        .slice(0, 5);
      return {
        searchId: search.id,
        status: "ready",
        total: postings.total,
        items,
      };
    }),
  );
  const groups: SavedSearchEvaluationGroup[] = settled.map(
    (result, index) =>
      result.status === "fulfilled"
        ? result.value
        : {
            searchId: searches[index].id,
            status: "error",
            total: null,
            items: [],
          },
  );

  return NextResponse.json(
    { evaluatedAt, groups },
    { headers: { "Cache-Control": "no-store" } },
  );
}
