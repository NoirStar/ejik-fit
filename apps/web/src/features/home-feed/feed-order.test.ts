import { describe, expect, it } from "vitest";

import { itemsForTab } from "./feed-order";
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
    id: "starter-community-1",
    type: "community_post",
    category: "커리어 질문",
    authorId: "server-garden",
    authorName: "가이드 작성자",
    authorHeadline: "읽기 전용",
    authorTone: "blue",
    createdAt: "2026-07-13T11:00:00.000Z",
    createdLabel: "가이드",
    title: "실제 팔로잉에 섞이면 안 되는 가이드",
    body: "가이드 본문",
    tags: ["가이드"],
    href: "/posts/starter-community-1",
    metrics: { reactions: 99, comments: 99, saves: 99 },
    source: "mock",
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
    verifiedLabel: "7월 13일",
    matchedRequiredSkills: [],
    missingRequiredSkills: [],
    matchedPreferredSkills: [],
    href: "/jobs/job-1",
    source: "api",
  },
  {
    id: "review-1",
    type: "interview_review",
    category: "면접 후기",
    authorId: "night-builder",
    authorName: "빌드하는밤",
    authorHeadline: "서버 개발자",
    authorTone: "green",
    createdAt: "2026-07-13T10:00:00.000Z",
    createdLabel: "1시간 전",
    companyType: "플랫폼 기업",
    role: "백엔드",
    stage: "1차 면접",
    title: "면접 후기",
    summary: "요약",
    tags: ["면접"],
    href: "/posts/review-1",
    metrics: { reactions: 20, comments: 7, saves: 4 },
    source: "mock",
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
  it("keeps the curated order while excluding read-only guidance", () => {
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
