import { describe, expect, it } from "vitest";

import { appendOnlyItemsForTab, itemsForTab } from "./feed-order";
import type { FeedItem } from "./types";

const items: FeedItem[] = [
  {
    id: "community-1",
    type: "community_post",
    category: "커리어 질문",
    authorId: "server-garden",
    authorName: "서버정원",
    authorHeadline: "백엔드 개발자",
    authorTone: "violet",
    createdAt: "2026-07-13T09:00:00.000Z",
    createdLabel: "2시간 전",
    title: "커뮤니티 질문",
    body: "본문",
    tags: ["백엔드"],
    href: "/posts/community-1",
    metrics: { reactions: 12, comments: 4, saves: 3 },
    source: "server",
  },
  {
    id: "local-community-1",
    type: "community_post",
    category: "일반",
    authorId: "server-garden",
    authorName: "나",
    authorHeadline: "이 기기에서 작성",
    authorTone: "blue",
    createdAt: "2026-07-13T11:00:00.000Z",
    createdLabel: "방금 전",
    title: "복구 영역에만 있어야 하는 로컬 글",
    body: "로컬 본문",
    tags: ["로컬"],
    href: "/posts/local-community-1",
    metrics: { reactions: 0, comments: 0, saves: 0 },
    source: "local",
  },
  {
    id: "job-1",
    postingId: "job-1",
    type: "recommended_job",
    companyName: "회사",
    title: "백엔드 개발자",
    location: "서울",
    careerLabel: "경력",
    employmentLabel: "정규직",
    sourceUrl: "https://example.com/job-1",
    firstSeenAt: "2026-07-13T08:00:00.000Z",
    verifiedLabel: "7월 13일",
    requiredSkills: [],
    preferredSkills: [],
    unspecifiedSkills: [],
    matchedRequiredSkills: [],
    missingRequiredSkills: [],
    matchedPreferredSkills: [],
    matchedUnspecifiedSkills: [],
    recommendationReason: null,
    href: "/jobs/job-1",
    source: "api",
  },
  {
    id: "market-1",
    type: "market_insight",
    skillName: "Kubernetes",
    title: "시장 인사이트",
    summary: "요약",
    postingCount: 14,
    requiredCount: 8,
    preferredCount: 4,
    unspecifiedCount: 2,
    sampleLabel: "14건",
    sourceLabel: "공식 채용페이지",
    href: "/skill-map?skill=Kubernetes",
    source: "api",
  },
];

describe("itemsForTab", () => {
  it("keeps the curated order while excluding recovery-only local posts", () => {
    expect(itemsForTab(items, "recommended").map(({ id }) => id)).toEqual([
      "community-1",
      "job-1",
      "market-1",
    ]);
  });

  it("keeps only followed social content for following", () => {
    expect(
      itemsForTab(items, "following", ["server-garden"]).map(({ id }) => id),
    ).toEqual(["community-1"]);
    expect(itemsForTab(items, "following")).toEqual([]);
  });

  it("sorts dated social content before undated API cards for latest", () => {
    expect(itemsForTab(items, "latest").map(({ id }) => id)).toEqual([
      "community-1",
      "job-1",
      "market-1",
    ]);
  });

  it("uses a job's first collection time in the latest tab", () => {
    const newerJob = {
      ...items[2],
      firstSeenAt: "2026-07-13T10:00:00.000Z",
    } as FeedItem;

    expect(
      itemsForTab([items[0], newerJob, items[3]], "latest").map(({ id }) => id),
    ).toEqual(["job-1", "community-1", "market-1"]);
  });

  it("ranks only social content by visible engagement for popular", () => {
    expect(itemsForTab(items, "popular").map(({ id }) => id)).toEqual([
      "community-1",
    ]);
  });

  it("does not mutate the source array", () => {
    const before = items.map(({ id }) => id);
    itemsForTab(items, "latest");
    expect(items.map(({ id }) => id)).toEqual(before);
  });
});

describe("appendOnlyItemsForTab", () => {
  it("appends a newly loaded latest item without moving visible cards", () => {
    const first = appendOnlyItemsForTab(items, "latest", []);
    const newerCommunity = {
      ...items[0],
      id: "community-new",
      createdAt: "2026-07-13T12:00:00.000Z",
    } as FeedItem;
    const next = appendOnlyItemsForTab(
      [...items, newerCommunity],
      "latest",
      first.orderIds,
    );

    expect(first.items.map(({ id }) => id)).toEqual([
      "community-1",
      "job-1",
      "market-1",
    ]);
    expect(next.items.map(({ id }) => id)).toEqual([
      "community-1",
      "job-1",
      "market-1",
      "community-new",
    ]);
  });

  it("keeps the popular ledger stable when a stronger post arrives", () => {
    const first = appendOnlyItemsForTab(items, "popular", []);
    const popularCommunity = {
      ...items[0],
      id: "community-popular",
      metrics: { reactions: 100, comments: 50, saves: 20 },
    } as FeedItem;
    const next = appendOnlyItemsForTab(
      [...items, popularCommunity],
      "popular",
      first.orderIds,
    );

    expect(next.items.map(({ id }) => id)).toEqual([
      "community-1",
      "community-popular",
    ]);
  });
});
