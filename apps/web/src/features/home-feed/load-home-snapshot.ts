import { buildHomeFeedSnapshot } from "@/features/home-feed/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { analyzeFit, getPostings, getSkillGraph, getSkillStats } from "@/lib/api";
import { homeContextFromSearchParams } from "@/lib/home-context";

export type HomeSearchParams = Record<string, string | string[] | undefined>;

export async function loadHomeSnapshot(
  resolvedSearchParams: HomeSearchParams = {},
) {
  const { careerPreferences, ownedSkills } = homeContextFromSearchParams(
    resolvedSearchParams,
  );
  const { careerCondition, targetDomain } = careerPreferences;
  const seed = ownedSkills[0];
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
        "커리어 방향 데이터를 불러오지 못했습니다.",
      )
    : Promise.resolve(null);

  const [postings, skillStats, graph, fit] = await Promise.all([
    settledResource(
      getPostings({ ...careerFilter, limit: 40 }),
      "채용공고 데이터를 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillStats({ ...careerFilter, limit: 8 }),
      "기술 수요 데이터를 불러오지 못했습니다.",
    ),
    settledResource(
      getSkillGraph({
        ...(seed ? { seed } : {}),
        include_evidence: true,
        owned_skills: ownedSkills,
        ...careerFilter,
        limit: 30,
      }),
      "기술 관계 데이터를 불러오지 못했습니다.",
    ),
    fitRequest,
  ]);

  return buildHomeFeedSnapshot({
    postings,
    skillStats,
    graph,
    fit,
    careerPreferences,
    ownedSkills,
  });
}

export function communityComposeMode(
  resolvedSearchParams: HomeSearchParams = {},
) {
  const composeParam = Array.isArray(resolvedSearchParams.compose)
    ? resolvedSearchParams.compose[0]
    : resolvedSearchParams.compose;
  return composeParam === "resume"
    ? "resume" as const
    : composeParam === "1"
      ? "new" as const
      : null;
}
