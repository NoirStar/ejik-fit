import { describe, expect, it } from "vitest";

import type {
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";

import { buildDashboardSnapshot } from "./model";

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

const stats: SkillStatsResponse = {
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
  nodes: [
    {
      id: "Java",
      label: "Java",
      category: "language",
      kind: "skill",
      domains: ["backend"],
      demand_count: 10,
      required_count: 8,
      preferred_count: 2,
      unspecified_count: 0,
      owned: true,
      seed: true,
    },
    {
      id: "Kafka",
      label: "Kafka",
      category: "infra",
      kind: "skill",
      domains: ["backend"],
      demand_count: 4,
      required_count: 2,
      preferred_count: 2,
      unspecified_count: 0,
      owned: false,
      seed: false,
    },
  ],
  edges: [
    {
      id: "Java-Kafka",
      source: "Java",
      target: "Kafka",
      score: 0.72,
      cooccurrence_count: 5,
      required_pair_count: 2,
      supporting_posting_ids: ["job-1"],
    },
  ],
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

describe("buildDashboardSnapshot", () => {
  it("derives the dashboard only from successful API resources", () => {
    const snapshot = buildDashboardSnapshot({
      postings: { status: "ready", data: postings },
      skillStats: { status: "ready", data: stats },
      graph: { status: "ready", data: graph },
      ownedSkills: ["Java"],
    });

    expect(snapshot.jobs.map((job) => job.companyName)).toEqual(["토스"]);
    expect(snapshot.jobs[0]).toMatchObject({
      matchedSkills: ["Java"],
      matchScore: 33,
      lastVerifiedLabel: "7월 13일",
    });
    expect(snapshot.skillDemand[0]).toMatchObject({
      label: "Kubernetes",
      count: 14,
      requiredCount: 8,
      preferredCount: 4,
    });
    expect(snapshot.adjacentSkills).toEqual([
      { label: "Kafka", cooccurrenceCount: 5 },
    ]);
    expect(snapshot.displayedPostingCount).toBe(1);
    expect(snapshot.displayedSourceCount).toBe(1);
    expect(snapshot.matchingPostingCount).toBe(1);
    expect(snapshot.lastVerifiedAt).toBe("2026-07-12T15:00:00.000Z");
    expect(snapshot.fitLabel).toBe("요구 기술 일치도");
    expect(JSON.stringify(snapshot)).not.toMatch(/38%|D-2|네이버|카카오/);
    expect(snapshot).not.toHaveProperty("trendPercent");
    expect(snapshot.jobs[0]).not.toHaveProperty("deadlineBadge");
  });

  it("does not synthesize jobs when postings are unavailable", () => {
    const snapshot = buildDashboardSnapshot({
      postings: { status: "error", message: "offline", retryable: true },
      skillStats: { status: "ready", data: stats },
      graph: { status: "ready", data: graph },
      ownedSkills: ["Java"],
    });

    expect(snapshot.status).toBe("partial");
    expect(snapshot.jobs).toEqual([]);
    expect(snapshot.displayedPostingCount).toBe(0);
  });
});
