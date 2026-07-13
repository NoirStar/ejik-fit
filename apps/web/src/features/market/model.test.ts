import { describe, expect, it } from "vitest";

import type { PostingListResponse, SkillStatsResponse } from "@/lib/types";

import {
  MARKET_CAREER_FILTERS,
  buildMarketFilterHref,
  buildMarketJobsHref,
  buildMarketOverviewSnapshot,
  normalizeMarketCareerType,
} from "./model";

const postings: PostingListResponse = {
  total: 2,
  items: [
    {
      id: "job-new",
      title: "플랫폼 엔지니어",
      company_name: "새회사",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://example.com/jobs/new",
      last_verified_at: "2026-07-14T03:00:00Z",
    },
    {
      id: "job-old",
      title: "백엔드 엔지니어",
      company_name: "예시회사",
      career_type: null,
      employment_type: null,
      career_min: 2,
      career_max: 5,
      location: null,
      status: "open",
      source_url: "https://example.org/jobs/old",
      last_verified_at: "invalid-date",
    },
  ],
};

const skillStats: SkillStatsResponse = {
  total: 2,
  items: [
    {
      skill: "Kubernetes",
      category: "infra",
      count: 12,
      required_count: 5,
      preferred_count: 4,
      unspecified_count: 3,
    },
    { skill: "Go", category: "language", count: 8 },
  ],
};

describe("market overview model", () => {
  it("normalizes only supported career filters", () => {
    expect(normalizeMarketCareerType("new_comer")).toBe("new_comer");
    expect(normalizeMarketCareerType(["experienced", "mixed"])).toBe("experienced");
    expect(normalizeMarketCareerType("unknown")).toBe("");
    expect(normalizeMarketCareerType(undefined)).toBe("");
    expect(
      MARKET_CAREER_FILTERS.find((filter) => filter.value === "mixed")?.label,
    ).toBe("신입·경력");
  });

  it("builds shareable market and related-job URLs", () => {
    expect(buildMarketFilterHref("experienced")).toBe(
      "/market?career_type=experienced",
    );
    expect(buildMarketFilterHref("")).toBe("/market");
    expect(buildMarketJobsHref("C++", "experienced")).toBe(
      "/jobs?q=C%2B%2B&career_type=experienced",
    );
    expect(buildMarketJobsHref("Go", "")).toBe("/jobs?q=Go");
  });

  it("builds an honest snapshot from ready API resources", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "experienced",
      postings: { status: "ready", data: postings },
      skillStats: { status: "ready", data: skillStats },
    });

    expect(snapshot.postingTotal).toBe(2);
    expect(snapshot.skillTotal).toBe(2);
    expect(snapshot.latestVerifiedAt).toBe("2026-07-14T03:00:00Z");
    expect(snapshot.skills[0]).toMatchObject({
      name: "Kubernetes",
      postingCount: 12,
      requiredCount: 5,
      preferredCount: 4,
      unspecifiedCount: 3,
      relativeDemand: 100,
      jobsHref: "/jobs?q=Kubernetes&career_type=experienced",
    });
    expect(snapshot.skills[1]).toMatchObject({
      name: "Go",
      requiredCount: 0,
      preferredCount: 0,
      unspecifiedCount: 0,
      relativeDemand: 67,
    });
    expect(snapshot.jobs).toEqual([
      expect.objectContaining({
        id: "job-new",
        careerLabel: "경력",
        employmentLabel: "정규직",
        location: "서울",
      }),
      expect.objectContaining({
        id: "job-old",
        careerLabel: "경력 미기재",
        employmentLabel: "고용 형태 미기재",
        location: "근무지 미기재",
      }),
    ]);
  });

  it("keeps ready skill data when postings fail", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "",
      postings: {
        status: "error",
        message: "공고 데이터를 불러오지 못했습니다.",
      },
      skillStats: { status: "ready", data: skillStats },
    });

    expect(snapshot.postingTotal).toBeNull();
    expect(snapshot.postingError).toBe("공고 데이터를 불러오지 못했습니다.");
    expect(snapshot.latestVerifiedAt).toBeNull();
    expect(snapshot.skills).toHaveLength(2);
    expect(snapshot.jobs).toEqual([]);
  });

  it("keeps ready postings when skill statistics fail", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "mixed",
      postings: { status: "ready", data: postings },
      skillStats: {
        status: "error",
        message: "기술 수요 데이터를 불러오지 못했습니다.",
      },
    });

    expect(snapshot.postingTotal).toBe(2);
    expect(snapshot.skillTotal).toBeNull();
    expect(snapshot.skillError).toBe("기술 수요 데이터를 불러오지 못했습니다.");
    expect(snapshot.skills).toEqual([]);
    expect(snapshot.jobs).toHaveLength(2);
  });
});
