import { buildHomeFeedSnapshot } from "@/features/home-feed/model";
import { settledResource } from "@/features/home-feed/resource-state";
import { getPostings } from "@/lib/api";
import { homeContextFromSearchParams } from "@/lib/home-context";

export type HomeSearchParams = Record<string, string | string[] | undefined>;

export async function loadHomeSnapshot(
  resolvedSearchParams: HomeSearchParams = {},
) {
  const { careerPreferences, ownedSkills } = homeContextFromSearchParams(
    resolvedSearchParams,
  );
  const postings = await settledResource(
    getPostings({ limit: 60 }),
    "채용공고 데이터를 불러오지 못했습니다.",
  );

  return buildHomeFeedSnapshot({
    postings,
    skillStats: { status: "ready", data: { items: [], total: 0 } },
    fit: null,
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
