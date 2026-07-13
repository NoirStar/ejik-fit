import { describe, expect, it } from "vitest";

import type {
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

import { buildHomeFeedSnapshot } from "./model";
import type { ResourceState } from "./resource-state";

const postings: PostingListResponse = {
  total: 1,
  items: [
    {
      id: "job-1",
      title: "Backend Engineer",
      company_name: "토스",
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

function ready<T>(data: T): ResourceState<T> {
  return { status: "ready", data };
}

describe("buildHomeFeedSnapshot", () => {
  it("mixes mock social content with API-backed jobs and skill demand", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      graph: ready(graph),
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
      matchedRequiredSkills: ["Java"],
      missingRequiredSkills: ["Spring"],
      matchedPreferredSkills: ["Kafka"],
    });
    expect(snapshot.marketInsights[0]).toMatchObject({
      skillName: "Kubernetes",
      postingCount: 14,
      requiredCount: 8,
      preferredCount: 4,
    });
    expect(snapshot.skillDemand).toEqual([
      {
        skillName: "Kubernetes",
        postingCount: 14,
        requiredCount: 8,
        preferredCount: 4,
      },
    ]);
    expect(snapshot.postingCount).toBe(1);
    expect(snapshot.sourceCount).toBe(1);
    expect(JSON.stringify(snapshot)).not.toContain("trendPercent");
    expect(JSON.stringify(snapshot)).not.toContain("matchScore");
  });

  it("keeps community and verified posting content when graph loading fails", () => {
    const snapshot = buildHomeFeedSnapshot({
      postings: ready(postings),
      skillStats: ready(skillStats),
      graph: { status: "error", message: "graph offline" },
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
      ownedSkills: [],
    });

    expect(snapshot.dataStatus).toBe("error");
    expect(snapshot.recommendedJobs).toEqual([]);
    expect(snapshot.marketInsights).toEqual([]);
    expect(snapshot.skillDemand).toEqual([]);
    expect(snapshot.feedItems.every((item) => item.source !== "api")).toBe(true);
  });
});
