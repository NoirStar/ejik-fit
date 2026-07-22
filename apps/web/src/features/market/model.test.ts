import { describe, expect, it } from "vitest";

import type { PostingListResponse, SkillStatsResponse } from "@/lib/types";

import {
  MARKET_CAREER_FILTERS,
  MARKET_CATEGORIES,
  buildSkillCombinations,
  buildMarketFilterHref,
  buildMarketJobsHref,
  buildMarketOverviewSnapshot,
  formatPostingCoverage,
  jobsForSkill,
  normalizeMarketCareerType,
  normalizeMarketCategory,
  sortMarketSkills,
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
      required_skills: ["Kubernetes"],
      preferred_skills: ["Docker"],
      unspecified_skills: [],
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
      required_skills: ["Go"],
      preferred_skills: [],
      unspecified_skills: [],
    },
  ],
};

const skillStats: SkillStatsResponse = {
  total: 69,
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

const explicitLeader: SkillStatsResponse = {
  total: 3,
  items: [
    {
      skill: "Python",
      category: "language",
      count: 20,
      required_count: 3,
      preferred_count: 2,
      unspecified_count: 15,
    },
    {
      skill: "AWS",
      category: "infra",
      count: 15,
      required_count: 7,
      preferred_count: 3,
      unspecified_count: 5,
    },
    {
      skill: "Go",
      category: "language",
      count: 10,
      required_count: 0,
      preferred_count: 0,
      unspecified_count: 10,
    },
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

  it("normalizes market categories from the actual skill catalog", () => {
    expect(normalizeMarketCategory("infra")).toBe("infra");
    expect(normalizeMarketCategory(["backend", "ai"])).toBe("backend");
    expect(normalizeMarketCategory("unsupported")).toBe("");
    expect(
      MARKET_CATEGORIES.find((filter) => filter.value === "embedded")?.label,
    ).toBe("임베디드");
  });

  it("builds shareable market and related-job URLs", () => {
    expect(buildMarketFilterHref("experienced", "infra")).toBe(
      "/market?category=infra&career_type=experienced",
    );
    expect(buildMarketFilterHref("experienced")).toBe(
      "/market?career_type=experienced",
    );
    expect(buildMarketFilterHref("")).toBe("/market");
    expect(buildMarketJobsHref("C++", "experienced", "infra")).toBe(
      "/jobs?q=C%2B%2B&category=infra&career_type=experienced",
    );
    expect(buildMarketJobsHref("Go", "")).toBe("/jobs?q=Go");
  });

  it("builds an honest snapshot from ready API resources", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "experienced",
      category: "infra",
      postings: { status: "ready", data: postings },
      skillStats: { status: "ready", data: skillStats },
    });

    expect(snapshot.postingTotal).toBe(2);
    expect(snapshot.postingCountLabel).toBe("2건 확인");
    expect(snapshot.skillTotal).toBe(69);
    expect(snapshot.latestVerifiedAt).toBe("2026-07-14T03:00:00Z");
    expect(snapshot.skills[0]).toMatchObject({
      id: "infra:kubernetes",
      name: "Kubernetes",
      postingCount: 12,
      explicitCount: 9,
      requiredCount: 5,
      preferredCount: 4,
      unspecifiedCount: 3,
      relativeExplicitDemand: 100,
      jobsHref:
        "/jobs?q=Kubernetes&category=infra&career_type=experienced",
    });
    expect(snapshot.categoryLabel).toBe("인프라");
    expect(snapshot.jobsBrowseHref).toBe(
      "/jobs?category=infra&career_type=experienced",
    );
    expect(snapshot.skills[1]).toMatchObject({
      name: "Go",
      explicitCount: 0,
      requiredCount: 0,
      preferredCount: 0,
      unspecifiedCount: 0,
      relativeExplicitDemand: 0,
    });
    expect(snapshot.jobs).toEqual([
      expect.objectContaining({
        id: "job-new",
        careerLabel: "경력",
        employmentLabel: "정규직",
        location: "서울",
        skills: ["Docker", "Kubernetes"],
        sourceUrl: "https://example.com/jobs/new",
      }),
      expect.objectContaining({
        id: "job-old",
        careerLabel: "경력 미기재",
        employmentLabel: "고용 형태 미기재",
        location: "근무지 미기재",
      }),
    ]);
  });

  it("formats the database-backed filtered posting total", () => {
    expect(formatPostingCoverage(100)).toBe("100건 확인");
    expect(formatPostingCoverage(147)).toBe("147건 확인");
    expect(formatPostingCoverage(99)).toBe("99건 확인");
    expect(formatPostingCoverage(null)).toBe("확인 불가");
  });

  it("sorts demand rows without mutating the API order", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "",
      postings: { status: "ready", data: postings },
      skillStats: { status: "ready", data: skillStats },
    });
    const original = snapshot.skills.map((skill) => skill.name);

    expect(sortMarketSkills(snapshot.skills, "required").map((skill) => skill.name)).toEqual([
      "Kubernetes",
      "Go",
    ]);
    expect(sortMarketSkills(snapshot.skills, "name").map((skill) => skill.name)).toEqual([
      "Go",
      "Kubernetes",
    ]);
    expect(snapshot.skills.map((skill) => skill.name)).toEqual(original);
  });

  it("derives and sorts explicit demand independently from total appearances", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "",
      postings: { status: "ready", data: postings },
      skillStats: { status: "ready", data: explicitLeader },
    });

    expect(snapshot.skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "AWS",
          explicitCount: 10,
          relativeExplicitDemand: 100,
        }),
        expect.objectContaining({
          name: "Python",
          explicitCount: 5,
          relativeExplicitDemand: 50,
        }),
        expect.objectContaining({
          name: "Go",
          explicitCount: 0,
          relativeExplicitDemand: 0,
        }),
      ]),
    );
    expect(
      sortMarketSkills(snapshot.skills, "explicit").map((skill) => skill.name),
    ).toEqual(["AWS", "Python", "Go"]);
    expect(
      sortMarketSkills(snapshot.skills, "demand").map((skill) => skill.name),
    ).toEqual(["Python", "AWS", "Go"]);
  });

  it("filters recent jobs by the selected technology", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "",
      postings: { status: "ready", data: postings },
      skillStats: { status: "ready", data: skillStats },
    });

    expect(jobsForSkill(snapshot.jobs, "Docker")).toEqual([
      expect.objectContaining({ id: "job-new" }),
    ]);
    expect(jobsForSkill(snapshot.jobs, "Go")).toEqual([
      expect.objectContaining({ id: "job-old" }),
    ]);
    expect(jobsForSkill(snapshot.jobs, "Python")).toEqual([]);
  });

  it("counts co-occurrence without calling it additional eligible jobs", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "",
      postings: { status: "ready", data: postings },
      skillStats: { status: "ready", data: skillStats },
    });

    expect(buildSkillCombinations(snapshot.jobs, 3)).toEqual([
      {
        id: "Docker::Kubernetes",
        skills: ["Docker", "Kubernetes"],
        postingCount: 1,
      },
    ]);
    expect(buildSkillCombinations(snapshot.jobs, 3, "Kubernetes")).toEqual([
      {
        id: "Docker::Kubernetes",
        skills: ["Docker", "Kubernetes"],
        postingCount: 1,
      },
    ]);
    expect(buildSkillCombinations(snapshot.jobs, 3, "Go")).toEqual([]);
  });

  it("keeps ready skill data when postings fail", () => {
    const snapshot = buildMarketOverviewSnapshot({
      careerType: "",
      category: "",
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
      category: "ai",
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
