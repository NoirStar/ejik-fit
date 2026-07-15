import type { Metadata } from "next";

import { MOCK_SOCIAL_ITEMS } from "@/features/home-feed/mock-community";
import { settledResource } from "@/features/home-feed/resource-state";
import {
  buildSearchSnapshot,
  normalizeSearchQuery,
  normalizeSearchScope,
} from "@/features/search/model";
import { SearchResults } from "@/features/search/search-results";
import { getPostings, getSkillStats } from "@/lib/api";
import { normalizePostingList } from "@/lib/posting-contract";
import type { SkillStatsResponse } from "@/lib/types";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

type SearchPageProps = {
  searchParams?: Promise<SearchParams>;
};

function ensureSkillStatsResponse(value: SkillStatsResponse) {
  const validCount = (count: unknown) =>
    typeof count === "number" && Number.isInteger(count) && count >= 0;
  const validOptionalCount = (count: unknown) =>
    count === undefined || validCount(count);

  if (
    !value ||
    !Array.isArray(value.items) ||
    !validCount(value.total) ||
    value.items.some(
      (item) =>
        !item ||
        typeof item.skill !== "string" ||
        item.skill.trim().length === 0 ||
        typeof item.category !== "string" ||
        item.category.trim().length === 0 ||
        !validCount(item.count) ||
        !validOptionalCount(item.required_count) ||
        !validOptionalCount(item.preferred_count) ||
        !validOptionalCount(item.unspecified_count),
    )
  ) {
    throw new TypeError("Invalid skill stats response");
  }
  return value;
}

async function resolvedParams(searchParams?: Promise<SearchParams>) {
  return (await searchParams) ?? {};
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps = {}): Promise<Metadata> {
  const params = await resolvedParams(searchParams);
  const query = normalizeSearchQuery(params.q);

  return {
    title: query ? `“${query}” 검색` : "통합 검색",
    description: query
      ? `“${query}”와 관련된 공식 채용공고, 기업, 기술 수요와 현재 브라우저의 커뮤니티 글·화면용 예시를 구분해 확인합니다.`
      : "공식 채용공고, 기업, 기술 수요와 현재 브라우저의 커뮤니티 글을 한곳에서 검색합니다.",
    alternates: { canonical: "/search" },
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps = {}) {
  const params = await resolvedParams(searchParams);
  const query = normalizeSearchQuery(params.q);
  const scope = normalizeSearchScope(params.scope);

  if (!query) {
    return (
      <SearchResults
        snapshot={buildSearchSnapshot({
          query,
          scope,
          postings: null,
          skillStats: null,
          communityItems: MOCK_SOCIAL_ITEMS,
        })}
      />
    );
  }

  const [postings, skillStats] = await Promise.all([
    settledResource(
      getPostings({ q: query, limit: 100 }).then(normalizePostingList),
      "공고 검색 결과를 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillStats({ limit: 100 }).then(ensureSkillStatsResponse),
      "기술 통계 표본을 불러오지 못했습니다.",
    ),
  ]);

  return (
    <SearchResults
      snapshot={buildSearchSnapshot({
        query,
        scope,
        postings,
        skillStats,
        communityItems: MOCK_SOCIAL_ITEMS,
      })}
    />
  );
}
