import { describe, expect, it } from "vitest";

import type {
  FitAnalyzeResponse,
  PostingListResponse,
  SkillStatsResponse,
} from "@/lib/types";

import {
  buildHomeFeedSnapshot,
  localCommunityPostToFeedItem,
  postingSummaryToFeedItem,
  serverCommunityPostToFeedItem,
} from "./model";
import type { ResourceState } from "./resource-state";

const postings: PostingListResponse = {
  total: 1,
  items: [
    {
      id: "job-1",
      title: "Backend Engineer",
      company_name: "토스",
      company_slug: "toss",
      career_type: "experienced",
      employment_type: "FULL_TIME",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://careers.toss.im/job-1",
      last_verified_at: "2026-07-12T15:00:00.000Z",
      required_skills: ["Java", "Spring"],
      preferred_skills: ["Kafka"],
      unspecified_skills: ["Linux"],
    },
  ],
};

const skillStats: SkillStatsResponse = {
  total: 1,
  items: [
    {
      skill: "Kubernetes",
      category: "infra",
      count: 14,
      required_count: 8,
      preferred_count: 4,
      unspecified_count: 2,
    },
  ],
};

const fit: FitAnalyzeResponse = {
  coverage: {
    matching_posting_count: 12,
    strong_fit_posting_count: 4,
  },
  domain_branches: [],
  recommended_next_skills: [
    {
      skill: "Kubernetes",
      reason: "보유 스킬과 함께 등장한 공고에서 8회 부족 요구사항으로 확인됨",
      required_count: 6,
      preferred_count: 2,
      supporting_posting_count: 8,
    },
  ],
};

function ready<T>(data: T): ResourceState<T> {
  return { status: "ready", data };
}

describe("buildHomeFeedSnapshot", () => {
  it("maps a server post without inventing or adjusting persisted metrics", () => {
    expect(
      serverCommunityPostToFeedItem(
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          author: {
            id: "11111111-1111-4111-8111-111111111111",
            nickname: "서버정원",
          },
          category: "커리어 질문",
          title: "서버 커뮤니티 질문",
          body: "실제 계정에 저장된 본문입니다.",
          tags: ["백엔드"],
          metrics: { reactions: 4, comments: 2, saves: 1 },
          createdAt: "2026-07-14T01:00:00.000Z",
          updatedAt: "2026-07-14T01:00:00.000Z",
        },
        new Date("2026-07-14T01:12:00.000Z"),
      ),
    ).toMatchObject({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      authorId: "11111111-1111-4111-8111-111111111111",
      authorName: "서버정원",
      authorHeadline: "커뮤니티 회원",
      createdLabel: "12분 전",
      href: "/posts/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      metrics: { reactions: 4, comments: 2, saves: 1 },
      source: "server",
    });
  });

  it("maps a browser-owned post without inventing engagement", () => {
    expect(
      localCommunityPostToFeedItem(
        {
          id: "local-first-post",
          category: "커리어 고민",
          title: "첫 이직 질문",
          body: "준비 순서가 궁금합니다.",
          tags: ["Java", "백엔드"],
          createdAt: "2026-07-14T01:00:00.000Z",
        },
        new Date("2026-07-14T01:12:00.000Z"),
      ),
    ).toEqual({
      id: "local-first-post",
      type: "community_post",
      category: "커리어 고민",
      authorId: "local-browser-user",
      authorName: "나",
      authorHeadline: "이 기기에서 작성",
      authorTone: "violet",
      createdAt: "2026-07-14T01:00:00.000Z",
      createdLabel: "12분 전",
      title: "첫 이직 질문",
      body: "준비 순서가 궁금합니다.",
      tags: ["Java", "백엔드"],
      href: "/posts/local-first-post",
      metrics: { reactions: 0, comments: 0, saves: 0 },
      source: "local",
    });
  });

  it("normalizes source-specific career and employment codes", () => {
    const sourceSpecificPostings: PostingListResponse = {
      total: 1,
      items: [
        {
          ...postings.items[0],
          career_type: "not_matter",
          employment_type: "FULL_TIME_WORKER",
        },
      ],
    };

    const snapshot = buildHomeFeedSnapshot({
      postings: ready(sourceSpecificPostings),
      skillStats: ready(skillStats),
      fit: null,
      ownedSkills: [],
    });

    expect(snapshot.recommendedJobs[0]).toMatchObject({
      careerLabel: "경력 무관",
      employmentLabel: "정규직",
    });
  });

  it("explains canonical matches when a saved skill uses a common alias", () => {
    const item = postingSummaryToFeedItem(
      {
        ...postings.items[0],
        required_skills: ["Kubernetes"],
        preferred_skills: [],
        unspecified_skills: [],
      },
      ["k8s"],
    );

    expect(item).toMatchObject({
      matchedRequiredSkills: ["Kubernetes"],
      missingRequiredSkills: [],
      recommendationReason: "Kubernetes 필수 요건 일치",
    });
  });

  it("uses the backend canonical identity for the full skill catalog", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready({
        canonical_owned_skills: ["Go"],
        total: 1,
        items: [{
          ...postings.items[0],
          required_skills: ["Go"],
          preferred_skills: [],
          unspecified_skills: [],
        }],
      }),
      skillStats: ready(skillStats),
      fit: null,
      ownedSkills: ["golang"],
    });

    expect(snapshot.ownedSkills).toEqual(["Go"]);
    expect(snapshot.recommendedJobs[0]).toMatchObject({
      matchedRequiredSkills: ["Go"],
      recommendationReason: "Go 필수 요건 일치",
    });
  });

  it("builds the action feed only from verified data", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      fit: ready(fit),
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "backend",
      },
      ownedSkills: ["Java", "Kafka"],
    });

    expect(snapshot.feedItems.map((item) => item.type)).toEqual([
      "recommended_job",
      "market_insight",
    ]);
    expect(snapshot.feedItems.every((item) => item.source === "api")).toBe(true);
    expect(JSON.stringify(snapshot)).not.toContain('"mock"');
    expect(snapshot.recommendedJobs[0]).toMatchObject({
      companyName: "토스",
      companyHref: "/companies/toss",
      requiredSkills: ["Java", "Spring"],
      preferredSkills: ["Kafka"],
      matchedRequiredSkills: ["Java"],
      missingRequiredSkills: ["Spring"],
      matchedPreferredSkills: ["Kafka"],
    });
    expect(snapshot.marketInsights[0]).toMatchObject({
      skillName: "Kubernetes",
      title: "Kubernetes 요구 공고",
      summary:
        "분석된 공고에서 필수 8건, 우대 4건, 필수·우대 미표기 2건으로 확인됐습니다.",
      postingCount: 14,
      requiredCount: 8,
      preferredCount: 4,
      unspecifiedCount: 2,
    });
    expect(snapshot.skillDemand).toEqual([
      {
        skillName: "Kubernetes",
        postingCount: 14,
        requiredCount: 8,
        preferredCount: 4,
        unspecifiedCount: 2,
      },
    ]);
    expect(snapshot.postingCount).toBe(1);
    expect(snapshot.sourceCount).toBe(1);
    expect(snapshot.careerInsight).toEqual({
      status: "ready",
      matchingPostingCount: 12,
      strongFitPostingCount: 4,
      nextSkill: {
        skillName: "Kubernetes",
        requiredCount: 6,
        preferredCount: 2,
        supportingPostingCount: 8,
      },
    });
    expect(snapshot.careerContext).toEqual({
      careerCondition: "experienced",
      careerConditionLabel: "경력",
      targetDomain: "backend",
      targetDomainLabel: "백엔드",
      configured: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain("trendPercent");
    expect(JSON.stringify(snapshot)).not.toContain("matchScore");
  });

  it("keeps market insight titles natural for vowel-ending skill names", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready({
        total: 2,
        items: [
          { ...skillStats.items[0], skill: "Java" },
          { ...skillStats.items[0], skill: "Go" },
        ],
      }),
      fit: null,
      ownedSkills: [],
    });

    expect(snapshot.marketInsights.map((insight) => insight.title)).toEqual([
      "Java 요구 공고",
      "Go 요구 공고",
    ]);
  });

  it("preserves backend recommendation order and explains confirmed matches", () => {
    const rankedPostings: PostingListResponse = {
      total: 3,
      items: [
        postings.items[0],
        {
          ...postings.items[0],
          id: "job-2",
          title: "Unrelated Frontend Engineer",
        },
        {
          ...postings.items[0],
          id: "job-3",
          title: "Java Platform Engineer",
        },
      ],
    };
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(rankedPostings),
      skillStats: ready(skillStats),
      fit: ready(fit),
      ownedSkills: ["Java", "Kafka"],
    });

    expect(snapshot.recommendedJobs.map((job) => job.postingId)).toEqual([
      "job-1",
      "job-2",
      "job-3",
    ]);
    expect(snapshot.recommendedJobs[0]).toMatchObject({
      matchedRequiredSkills: ["Java"],
      missingRequiredSkills: ["Spring"],
      matchedPreferredSkills: ["Kafka"],
      matchedUnspecifiedSkills: [],
      recommendationReason: "내 기술 2개 일치",
    });
  });

  it("uses requirement-specific copy for one match and marks exploration quietly", () => {
    const recommendationPostings: PostingListResponse = {
      total: 3,
      items: [
        {
          ...postings.items[0],
          id: "required",
          required_skills: ["C++"],
          preferred_skills: [],
          unspecified_skills: [],
        },
        {
          ...postings.items[0],
          id: "unspecified",
          required_skills: [],
          preferred_skills: [],
          unspecified_skills: ["C++"],
        },
        {
          ...postings.items[0],
          id: "explore",
          required_skills: ["Python"],
          preferred_skills: [],
          unspecified_skills: [],
        },
      ],
    };

    const snapshot = buildHomeFeedSnapshot({
      postings: ready(recommendationPostings),
      skillStats: ready(skillStats),
      fit: null,
      ownedSkills: ["C++"],
    });

    expect(snapshot.recommendedJobs.map((job) => job.recommendationReason))
      .toEqual([
        "C++ 필수 요건 일치",
        "C++ 기술 포함",
        "새로운 분야 탐색",
      ]);
    expect(snapshot.recommendedJobs[1].matchedUnspecifiedSkills).toEqual([
      "C++",
    ]);
  });

  it("keeps every fetched posting while reporting the backend total", () => {
    const manyPostings: PostingListResponse = {
      total: 125,
      items: Array.from({ length: 25 }, (_, index) => ({
        ...postings.items[0],
        id: `job-${index + 1}`,
        title: `Backend Engineer ${index + 1}`,
      })),
    };

    const snapshot = buildHomeFeedSnapshot({
      postings: ready(manyPostings),
      skillStats: ready(skillStats),
      fit: null,
      ownedSkills: [],
    });

    expect(snapshot.recommendedJobs).toHaveLength(25);
    expect(snapshot.postingCount).toBe(125);
  });

  it("records a generic fallback without treating verified data as failed", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      fit: ready(fit),
      ownedSkills: ["Java"],
      personalizationFallback: true,
    });

    expect(snapshot.dataStatus).toBe("ready");
    expect(snapshot.feedItems.every((item) => item.source === "api")).toBe(true);
    expect(snapshot.recommendedJobs).toHaveLength(1);
    expect(snapshot.recommendedJobs[0].matchedRequiredSkills).toEqual(["Java"]);
    expect(snapshot.personalizationFallback).toBe(true);
    expect(snapshot.resourceErrors).toEqual([]);
  });

  it("does not replace unavailable verified data with mock numbers", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: { status: "error", message: "postings offline" },
      skillStats: { status: "error", message: "stats offline" },
      fit: null,
      ownedSkills: [],
    });

    expect(snapshot.dataStatus).toBe("error");
    expect(snapshot.recommendedJobs).toEqual([]);
    expect(snapshot.marketInsights).toEqual([]);
    expect(snapshot.skillDemand).toEqual([]);
    expect(snapshot.careerInsight).toEqual({ status: "needs_skills" });
    expect(snapshot.feedItems).toEqual([]);
    expect(JSON.stringify(snapshot)).not.toContain('"mock"');
  });

  it("marks only the personalized insight unavailable when fit analysis fails", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      fit: { status: "error", message: "fit offline" },
      ownedSkills: ["Java"],
    });

    expect(snapshot.dataStatus).toBe("partial");
    expect(snapshot.careerInsight).toEqual({ status: "unavailable" });
    expect(snapshot.resourceErrors).toEqual(["fit offline"]);
  });

  it("treats a verified zero-match comparison as a completed analysis", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready({ items: [], total: 0 }),
      skillStats: ready({ items: [], total: 0 }),
      fit: ready({
        coverage: {
          matching_posting_count: 0,
          strong_fit_posting_count: 0,
        },
        domain_branches: [],
        recommended_next_skills: [],
      }),
      ownedSkills: ["Unknown Tool"],
    });

    expect(snapshot.dataStatus).toBe("ready");
    expect(snapshot.careerInsight).toEqual({
      status: "ready",
      matchingPostingCount: 0,
      strongFitPostingCount: 0,
      nextSkill: null,
    });
  });
});
