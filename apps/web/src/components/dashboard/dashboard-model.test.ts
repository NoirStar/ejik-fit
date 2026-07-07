import { describe, expect, it } from "vitest";

import { buildDailyDashboardModel } from "./dashboard-model";

import type {
  PostingListResponse,
  SkillGraphResponse,
  SkillStatsResponse,
} from "@/lib/types";


const postings: PostingListResponse = {
  total: 2,
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
      source_url: "https://example.com/job-1",
      last_verified_at: "2026-07-07T00:00:00.000Z",
    },
    {
      id: "job-2",
      title: "SRE Engineer",
      company_name: "라인",
      career_type: "mixed",
      employment_type: "FULL_TIME",
      career_min: null,
      career_max: null,
      location: "성남",
      status: "open",
      source_url: "https://example.com/job-2",
      last_verified_at: "2026-07-06T00:00:00.000Z",
    },
  ],
};


const graph: SkillGraphResponse = {
  seed: "Java",
  nodes: [
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
  meta: {
    limit: 30,
    min_confidence: 0.8,
  },
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


describe("buildDailyDashboardModel", () => {
  it("builds matched jobs from graph evidence and keeps missing skills for inspector", () => {
    const model = buildDailyDashboardModel({
      postings,
      graph,
      skillStats,
      ownedSkills: ["Java", "Spring"],
      now: new Date("2026-07-07T00:00:00.000Z"),
    });

    expect(model.mode).toBe("supplemented");
    expect(model.jobs[0]).toMatchObject({
      id: "job-1",
      companyName: "토스",
      fitScore: 84,
      matchedSkills: ["Java", "Spring"],
      missingSkills: ["Kafka"],
      isSupplemental: false,
    });
    expect(model.jobs[1]).toMatchObject({
      id: "job-2",
      isSupplemental: true,
    });
    expect(model.summary.highFitJobCount).toBe(1);
    expect(model.summary.gapSkillCount).toBe(1);
    expect(model.trendingSkills[0].label).toBe("Kubernetes");
    expect(model.cooccurringSkills[0].label).toBe("Kafka");
  });

  it("falls back to new postings when there are no matched jobs", () => {
    const model = buildDailyDashboardModel({
      postings,
      graph: { ...graph, evidence: [] },
      skillStats,
      ownedSkills: ["Go"],
      now: new Date("2026-07-07T00:00:00.000Z"),
    });

    expect(model.mode).toBe("supplemented");
    expect(model.jobs).toHaveLength(2);
    expect(model.jobs.every((job) => job.isSupplemental)).toBe(true);
    expect(model.jobs[0].recommendationReasons[0]).toContain("전체 신규 공고");
  });
});
