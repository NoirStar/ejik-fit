import { describe, expect, it } from "vitest";

import { groupFeedForDisplay } from "./feed-display-groups";
import type {
  CommunityPostFeedItem,
  RecommendedJobFeedItem,
} from "./types";

function community(id: string): CommunityPostFeedItem {
  return {
    id,
    type: "community_post",
    category: "일반",
    authorId: "author",
    authorName: "작성자",
    authorHeadline: "커뮤니티 회원",
    authorTone: "violet",
    createdAt: "2026-07-28T00:00:00.000Z",
    createdLabel: "방금 전",
    title: id,
    body: "본문",
    tags: [],
    href: `/posts/${id}`,
    metrics: { reactions: 0, comments: 0, saves: 0 },
    source: "server",
  };
}

function job(id: string): RecommendedJobFeedItem {
  return {
    id,
    postingId: id,
    type: "recommended_job",
    companyName: "기업",
    title: id,
    location: "서울",
    careerLabel: "경력 무관",
    employmentLabel: "정규직",
    sourceUrl: `https://example.com/${id}`,
    firstSeenAt: "2026-07-28T00:00:00.000Z",
    verifiedLabel: "7월 28일",
    requiredSkills: [],
    preferredSkills: [],
    unspecifiedSkills: [],
    matchedRequiredSkills: [],
    missingRequiredSkills: [],
    matchedPreferredSkills: [],
    matchedUnspecifiedSkills: [],
    recommendationReason: null,
    href: `/jobs/${id}`,
    source: "api",
  };
}

describe("groupFeedForDisplay", () => {
  it("keeps an isolated job as one job group between community items", () => {
    expect(
      groupFeedForDisplay([community("c1"), job("j1"), community("c2")]),
    ).toMatchObject([
      { kind: "item", item: { id: "c1" } },
      { kind: "jobs", items: [{ id: "j1" }] },
      { kind: "item", item: { id: "c2" } },
    ]);
  });

  it("collects every consecutive job into one stable group", () => {
    expect(groupFeedForDisplay([job("j1"), job("j2"), job("j3")]))
      .toMatchObject([
        {
          kind: "jobs",
          items: [{ id: "j1" }, { id: "j2" }, { id: "j3" }],
        },
      ]);
  });
});
