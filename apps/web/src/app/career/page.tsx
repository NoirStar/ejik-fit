import type { Metadata } from "next";

import {
  CareerOverview,
  type CareerSkillSuggestion,
} from "@/features/career/career-overview";
import { buildCareerDomainSuggestions } from "@/features/career/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { getSkillGraph, getSkillStats } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 커리어",
  description: "브라우저에 저장한 내 기술과 현재 공식 채용공고의 요구사항을 비교합니다.",
};

function buildCareerSkillSuggestions(value: unknown): CareerSkillSuggestion[] {
  if (!value || typeof value !== "object") {
    throw new Error("invalid skill suggestion response");
  }
  const items = (value as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    throw new Error("invalid skill suggestion response");
  }

  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("invalid skill suggestion item");
    }
    const candidate = item as { skill?: unknown; count?: unknown };
    if (
      typeof candidate.skill !== "string" ||
      typeof candidate.count !== "number" ||
      !Number.isSafeInteger(candidate.count) ||
      candidate.count < 0
    ) {
      throw new Error("invalid skill suggestion item");
    }

    const name = candidate.skill.trim();
    const key = name.toLocaleLowerCase("en-US");
    if (!name || seen.has(key)) return [];
    seen.add(key);
    return [{ name, postingCount: candidate.count }];
  });
}

export default async function CareerPage() {
  const [skillSuggestions, domainSuggestions] = await Promise.all([
    settledResource(
      getSkillStats({ limit: 12 }).then(buildCareerSkillSuggestions),
      "상위 기술 제안을 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillGraph({ limit: 60 }).then(buildCareerDomainSuggestions),
      "분야 목록을 불러오지 못했습니다.",
    ),
  ]);

  return (
    <CareerOverview
      domainSuggestions={
        domainSuggestions.status === "ready" ? domainSuggestions.data : []
      }
      domainSuggestionsUnavailable={domainSuggestions.status === "error"}
      suggestions={
        skillSuggestions.status === "ready" ? skillSuggestions.data : []
      }
      suggestionsUnavailable={skillSuggestions.status === "error"}
    />
  );
}
