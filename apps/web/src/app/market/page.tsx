import type { Metadata } from "next";

import { MarketOverview } from "@/features/market/market-overview";
import {
  buildMarketOverviewSnapshot,
  normalizeMarketCareerType,
  normalizeMarketCategory,
} from "@/features/market/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "채용 시장",
  description: "공식 채용 페이지의 현재 공개 공고에서 확인한 커리어 분야별 수요를 살펴봅니다.",
};

type MarketSearchParams = Record<string, string | string[] | undefined>;

type MarketPageProps = {
  searchParams?: Promise<MarketSearchParams>;
};

export default async function MarketPage({ searchParams }: MarketPageProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const careerType = normalizeMarketCareerType(
    resolvedSearchParams.career_type,
  );
  const category = normalizeMarketCategory(resolvedSearchParams.category);
  const fieldValue = Array.isArray(resolvedSearchParams.field)
    ? resolvedSearchParams.field[0]
    : resolvedSearchParams.field;
  const field = fieldValue?.trim() ?? "";
  const careerFilter = careerType ? { career_type: careerType } : {};
  const categoryFilter = category ? { category } : {};

  const [postings, skillStats, graph] = await Promise.all([
    settledResource(
      getPostings({ ...careerFilter, ...categoryFilter, limit: 100 }),
      "공고 데이터를 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillStats({ ...careerFilter, ...categoryFilter, limit: 100 }),
      "기술 수요 데이터를 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillGraph({ ...careerFilter, include_evidence: true, limit: 100 }),
      "분야별 채용 현황을 불러오지 못했습니다.",
    ),
  ]);

  return (
    <MarketOverview
      snapshot={buildMarketOverviewSnapshot({
        careerType,
        category,
        field,
        postings,
        skillStats,
        graph,
      })}
    />
  );
}
