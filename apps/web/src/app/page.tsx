import type { Metadata } from "next";

import { loadInitialCommunityFeed } from "@/features/community/server-community-feed";
import { HomeFeed } from "@/features/home-feed/home-feed";
import { buildHomeFeedSnapshot } from "@/features/home-feed/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { analyzeFit, getPostings, getSkillStats } from "@/lib/api";
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

async function loadHomePostings(
  careerFilter: { career_type?: string },
  ownedSkills: string[],
) {
  const postings = await settledResource(
    getPostings({
      ...careerFilter,
      limit: 20,
      ...(ownedSkills.length > 0 ? { owned_skills: ownedSkills } : {}),
    }),
    "공고를 불러오지 못했습니다.",
  );
  if (postings.status === "ready" || ownedSkills.length === 0) {
    return { personalizationFallback: false, postings };
  }

  const fallback = await settledResource(
    getPostings({ ...careerFilter, limit: 20 }),
    "공고를 불러오지 못했습니다.",
  );
  return {
    personalizationFallback: fallback.status === "ready",
    postings: fallback,
  };
}

export default async function Home({ searchParams }: HomeProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { careerPreferences, ownedSkills } = homeContextFromSearchParams(
    resolvedSearchParams,
  );
  const { careerCondition, targetDomain } = careerPreferences;
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
  const feedScopeKey = JSON.stringify([
    careerCondition,
    targetDomain,
    ownedSkills,
  ]);

  const fitRequest = ownedSkills.length > 0
    ? settledResource(
        analyzeFit({
          owned_skills: ownedSkills,
          ...careerFilter,
          ...(targetDomain ? { domains: [targetDomain] } : {}),
        }),
        "내 기술이 포함된 공고를 불러오지 못했습니다.",
      )
    : Promise.resolve(null);

  const [postingResult, skillStats, fit, initialCommunityFeed] = await Promise.all([
    loadHomePostings(careerFilter, ownedSkills),
    settledResource(
      getSkillStats({ ...careerFilter, limit: 8 }),
      "채용 시장 기술 수요를 불러오지 못했습니다.",
    ),
    fitRequest,
    loadInitialCommunityFeed(10),
  ]);

  return (
    <HomeFeed
      composeMode={composeMode}
      initialCommunityFeed={initialCommunityFeed}
      key={feedScopeKey}
      snapshot={buildHomeFeedSnapshot({
        postings: postingResult.postings,
        skillStats,
        fit,
        careerPreferences,
        ownedSkills,
        personalizationFallback: postingResult.personalizationFallback,
      })}
    />
  );
}
