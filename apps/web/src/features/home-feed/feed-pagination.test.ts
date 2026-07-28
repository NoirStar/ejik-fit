import { describe, expect, it } from "vitest";

import { interleaveHomeSources, takeUniqueFeedPage } from "./feed-pagination";
import type {
  CommunityPostFeedItem,
  MarketInsightFeedItem,
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
    createdAt: "2026-07-27T00:00:00.000Z",
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
    employmentLabel: "고용 형태 미기재",
    sourceUrl: `https://example.com/${id}`,
    firstSeenAt: "2026-07-27T00:00:00.000Z",
    verifiedLabel: "7월 27일",
    requiredSkills: [],
    preferredSkills: [],
    matchedRequiredSkills: [],
    missingRequiredSkills: [],
    matchedPreferredSkills: [],
    href: `/jobs/${id}`,
    source: "api",
  };
}

function market(id: string): MarketInsightFeedItem {
  return {
    id,
    type: "market_insight",
    skillName: id,
    title: id,
    summary: "요약",
    postingCount: 1,
    requiredCount: 1,
    preferredCount: 0,
    unspecifiedCount: 0,
    sampleLabel: "1건",
    sourceLabel: "공식 채용페이지",
    href: `/skill-map?skill=${id}`,
    source: "api",
  };
}

describe("home feed pagination", () => {
  it("interleaves one community item with two jobs and fixed first-page insights", () => {
    const queue = interleaveHomeSources({
      community: [community("c1"), community("c2"), community("c3")],
      jobs: [job("j1"), job("j2"), job("j3"), job("j4"), job("j5")],
      insights: [market("m1"), market("m2")],
    });

    expect(queue.map(({ id }) => id)).toEqual([
      "c1",
      "j1",
      "m1",
      "j2",
      "c2",
      "j3",
      "j4",
      "m2",
      "c3",
      "j5",
    ]);
  });

  it("takes an append page without repeating prior or queued IDs", () => {
    const page = takeUniqueFeedPage(
      [job("j1"), job("j1"), job("j2")],
      new Set(["j0"]),
      2,
    );

    expect(page.items.map(({ id }) => id)).toEqual(["j1", "j2"]);
    expect(page.remaining).toEqual([]);
  });
});
