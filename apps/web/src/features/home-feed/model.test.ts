import { describe, expect, it } from "vitest";

import type {
  FitAnalyzeResponse,
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

import {
  buildHomeFeedSnapshot,
  localCommunityPostToFeedItem,
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

const graph: SkillGraphResponse = {
  seed: "Java",
  nodes: [],
  edges: [],
  evidence: [
    {
      posting_id: "job-1",
      title: "Backend Engineer",
      company_name: "토스",
      skills: ["Java", "Spring", "Kafka"],
      required: ["Java", "Spring"],
      preferred: ["Kafka"],
      unspecified: [],
    },
  ],
  meta: { limit: 30, min_confidence: 0.8 },
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
  it("maps a browser-owned post without inventing engagement", () => {
    expect(
      localCommunityPostToFeedItem(
        {
          id: "local-first-post",
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
      category: "업무 이야기",
      authorId: "local-browser-user",
      authorName: "나",
      authorHeadline: "이 브라우저에서 작성",
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
      graph: ready(graph),
      fit: null,
      ownedSkills: [],
    });

    expect(snapshot.recommendedJobs[0]).toMatchObject({
      careerLabel: "경력 무관",
      employmentLabel: "정규직",
    });
  });

  it("mixes mock social content with API-backed jobs and skill demand", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      graph: ready(graph),
      fit: ready(fit),
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "backend",
      },
      ownedSkills: ["Java", "Kafka"],
    });

    expect(snapshot.feedItems.slice(0, 4).map((item) => item.type)).toEqual([
      "community_post",
      "recommended_job",
      "interview_review",
      "market_insight",
    ]);
    expect(snapshot.recommendedJobs[0]).toMatchObject({
      companyName: "토스",
      companyHref: "/companies/toss",
      matchedRequiredSkills: ["Java"],
      missingRequiredSkills: ["Spring"],
      matchedPreferredSkills: ["Kafka"],
    });
    expect(snapshot.marketInsights[0]).toMatchObject({
      skillName: "Kubernetes",
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

  it("prioritizes a later posting when verified skill evidence matches my stack", () => {
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
    const rankedGraph: SkillGraphResponse = {
      ...graph,
      evidence: [
        {
          posting_id: "job-3",
          title: "Java Platform Engineer",
          company_name: "토스",
          skills: ["Java", "Kafka", "Spring"],
          required: ["Java", "Spring"],
          preferred: ["Kafka"],
          unspecified: [],
        },
      ],
    };

    const snapshot = buildHomeFeedSnapshot({
      postings: ready(rankedPostings),
      skillStats: ready(skillStats),
      graph: ready(rankedGraph),
      fit: ready(fit),
      ownedSkills: ["Java", "Kafka"],
    });

    expect(snapshot.recommendedJobs.map((job) => job.postingId)).toEqual([
      "job-3",
      "job-1",
    ]);
    expect(snapshot.recommendedJobs[0]).toMatchObject({
      matchedRequiredSkills: ["Java"],
      missingRequiredSkills: ["Spring"],
      matchedPreferredSkills: ["Kafka"],
    });
  });

  it("keeps community and verified posting content when graph loading fails", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      graph: { status: "error", message: "graph offline" },
      fit: ready(fit),
      ownedSkills: ["Java"],
    });

    expect(snapshot.dataStatus).toBe("partial");
    expect(snapshot.communityItems.length).toBeGreaterThan(0);
    expect(snapshot.recommendedJobs).toHaveLength(1);
    expect(snapshot.recommendedJobs[0].matchedRequiredSkills).toEqual([]);
    expect(snapshot.resourceErrors).toEqual(["graph offline"]);
  });

  it("does not replace unavailable verified data with mock numbers", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: { status: "error", message: "postings offline" },
      skillStats: { status: "error", message: "stats offline" },
      graph: { status: "error", message: "graph offline" },
      fit: null,
      ownedSkills: [],
    });

    expect(snapshot.dataStatus).toBe("error");
    expect(snapshot.recommendedJobs).toEqual([]);
    expect(snapshot.marketInsights).toEqual([]);
    expect(snapshot.skillDemand).toEqual([]);
    expect(snapshot.careerInsight).toEqual({ status: "needs_skills" });
    expect(snapshot.feedItems.every((item) => item.source !== "api")).toBe(true);
  });

  it("marks only the personalized insight unavailable when fit analysis fails", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      graph: ready(graph),
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
      graph: ready({
        seed: "Unknown Tool",
        nodes: [],
        edges: [],
        evidence: [],
        meta: { limit: 30, min_confidence: 0.8 },
      }),
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
