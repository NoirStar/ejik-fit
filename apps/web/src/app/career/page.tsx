import type { Metadata } from "next";

import {
  CareerOverview,
  type CareerSkillSuggestion,
} from "@/features/career/career-overview";
import { buildCareerDomainSuggestions } from "@/features/career/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { getSkillCatalog, getSkillGraph, getSkillStats } from "@/lib/api";
import { parseSkillCatalogResponse } from "@/lib/skill-catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 커리어",
  description: "내 기술과 채용공고를 비교해 다음에 준비할 기술을 찾습니다.",
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
  const [skillSuggestions, skillCatalog, domainSuggestions] = await Promise.all([
    settledResource(
      getSkillStats({ limit: 12 }).then(buildCareerSkillSuggestions),
      "상위 기술 제안을 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillCatalog().then(
        (response) => parseSkillCatalogResponse(response).items,
      ),
      "표준 기술명 목록을 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillGraph({ limit: 60 }).then(buildCareerDomainSuggestions),
      "분야 목록을 불러오지 못했습니다.",
    ),
  ]);

  return (
    <CareerOverview
      catalog={skillCatalog.status === "ready" ? skillCatalog.data : []}
      catalogUnavailable={skillCatalog.status === "error"}
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
