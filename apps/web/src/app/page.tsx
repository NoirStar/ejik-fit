import type { Metadata } from "next";

import { loadInitialCommunityFeed } from "@/features/community/server-community-feed";
import { HomeFeed } from "@/features/home-feed/home-feed";
import { buildHomeFeedSnapshot } from "@/features/home-feed/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { analyzeFit, getPostings, getSkillGraph, getSkillStats } from "@/lib/api";
import { homeContextFromSearchParams } from "@/lib/home-context";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이직핏 홈",
  description:
    "커리어 이야기와 채용공고의 기술 수요를 한곳에서 확인합니다.",
};

type HomeSearchParams = Record<string, string | string[] | undefined>;

type HomeProps = {
  searchParams?: Promise<HomeSearchParams>;
};

export default async function Home({ searchParams }: HomeProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { careerPreferences, ownedSkills } = homeContextFromSearchParams(
    resolvedSearchParams,
  );
  const { careerCondition, targetDomain } = careerPreferences;
  const seed = ownedSkills[0];
  const composeParam = Array.isArray(resolvedSearchParams.compose)
    ? resolvedSearchParams.compose[0]
    : resolvedSearchParams.compose;
  const composeMode =
    composeParam === "resume"
      ? "resume"
      : composeParam === "1"
        ? "new"
        : null;
  const careerFilter = careerCondition
    ? { career_type: careerCondition }
    : {};

  const fitRequest = ownedSkills.length > 0
    ? settledResource(
        analyzeFit({
          owned_skills: ownedSkills,
          ...careerFilter,
          ...(targetDomain ? { domains: [targetDomain] } : {}),
        }),
        "내 기술과 맞는 공고를 불러오지 못했습니다.",
      )
    : Promise.resolve(null);

  const [postings, skillStats, graph, fit, initialCommunityFeed] = await Promise.all([
    settledResource(
      getPostings({ ...careerFilter, limit: 40 }),
      "공고를 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillStats({ ...careerFilter, limit: 8 }),
      "채용 시장 기술 수요를 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillGraph({
        ...(seed ? { seed } : {}),
        owned_skills: ownedSkills,
        ...careerFilter,
        limit: 30,
      }),
      "스킬맵을 불러오지 못했습니다.",
    ),
    fitRequest,
    loadInitialCommunityFeed(),
  ]);

  return (
    <HomeFeed
      composeMode={composeMode}
      initialCommunityFeed={initialCommunityFeed}
      snapshot={buildHomeFeedSnapshot({
        postings,
        skillStats,
        graph,
        fit,
        careerPreferences,
        ownedSkills,
      })}
    />
  );
}
