import type { Metadata } from "next";

import { HomeFeed } from "@/features/home-feed/home-feed";
import { buildHomeFeedSnapshot } from "@/features/home-feed/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";
import { ownedSkillsFromSearchParams } from "@/lib/owned-skills";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "이직핏 홈",
  description:
    "커리어 커뮤니티의 경험과 공식 채용공고의 기술 수요를 한 피드에서 확인합니다.",
};

type HomeSearchParams = Record<string, string | string[] | undefined>;

type HomeProps = {
  searchParams?: Promise<HomeSearchParams>;
};

export default async function Home({ searchParams }: HomeProps = {}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const ownedSkills = ownedSkillsFromSearchParams(resolvedSearchParams);
  const seed = ownedSkills[0];

  const [postings, skillStats, graph] = await Promise.all([
    settledResource(getPostings({ limit: 40 })),
    settledResource(getSkillStats({ limit: 8 })),
    settledResource(
      getSkillGraph({
        ...(seed ? { seed } : {}),
        owned_skills: ownedSkills,
        limit: 30,
      }),
    ),
  ]);

  return (
    <HomeFeed
      composeInitiallyOpen={resolvedSearchParams.compose === "1"}
      snapshot={buildHomeFeedSnapshot({
        postings,
        skillStats,
        graph,
        ownedSkills,
      })}
    />
  );
}
