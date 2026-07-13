import type { Metadata } from "next";

import {
  CareerOverview,
  type CareerSkillSuggestion,
} from "@/features/career/career-overview";
import { settledResource } from "@/features/home-feed/resource-state";
import { getSkillStats } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 커리어",
  description: "브라우저에 저장한 내 기술과 현재 공식 채용공고의 요구사항을 비교합니다.",
};

export default async function CareerPage() {
  const skillStats = await settledResource(
    getSkillStats({ limit: 12 }),
    "상위 기술 제안을 불러오지 못했습니다.",
  );
  const seen = new Set<string>();
  const suggestions: CareerSkillSuggestion[] =
    skillStats.status === "ready"
      ? skillStats.data.items.flatMap((item) => {
          const name = item.skill.trim();
          const key = name.toLocaleLowerCase("en-US");
          if (!name || seen.has(key)) return [];
          seen.add(key);
          return [{ name, postingCount: item.count }];
        })
      : [];

  return (
    <CareerOverview
      suggestions={suggestions}
      suggestionsUnavailable={skillStats.status === "error"}
    />
  );
}
