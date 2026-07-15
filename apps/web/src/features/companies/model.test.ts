import { describe, expect, it } from "vitest";

import type { PostingSummary } from "@/lib/types";

import { buildCompanyHiringSnapshot } from "./model";

const base: PostingSummary = {
  id: "job-1",
  title: "플랫폼 엔지니어",
  company_name: "검증 기업",
  company_slug: "verified-company",
  career_type: "experienced",
  employment_type: "FULL_TIME_WORKER",
  career_min: 3,
  career_max: 7,
  location: "서울",
  status: "open",
  source_url: "https://careers.example.com/job-1",
  last_verified_at: "2026-07-14T03:00:00Z",
  required_skills: ["Go", "go"],
  preferred_skills: ["Kubernetes", "Go"],
  unspecified_skills: ["Linux", "kubernetes"],
};

describe("company hiring evidence model", () => {
  it("counts each skill once per posting with requirement precedence", () => {
    const snapshot = buildCompanyHiringSnapshot([
      base,
      {
        ...base,
        id: "job-2",
        title: "백엔드 엔지니어",
        career_type: "mixed",
        employment_type: "CONTRACT_WORKER",
        location: "판교",
        last_verified_at: "2026-07-13T03:00:00Z",
        required_skills: ["Kubernetes"],
        preferred_skills: ["GO"],
        unspecified_skills: ["Linux", "Rust"],
      },
    ]);

    expect(snapshot.skills).toEqual([
      {
        name: "Go",
        postingCount: 2,
        requiredCount: 1,
        preferredCount: 1,
        unspecifiedCount: 0,
      },
      {
        name: "Kubernetes",
        postingCount: 2,
        requiredCount: 1,
        preferredCount: 1,
        unspecifiedCount: 0,
      },
      {
        name: "Linux",
        postingCount: 2,
        requiredCount: 0,
        preferredCount: 0,
        unspecifiedCount: 2,
      },
      {
        name: "Rust",
        postingCount: 1,
        requiredCount: 0,
        preferredCount: 0,
        unspecifiedCount: 1,
      },
    ]);
  });

  it("summarizes only loaded API facts and labels missing values", () => {
    const snapshot = buildCompanyHiringSnapshot([
      base,
      {
        ...base,
        id: "job-2",
        career_type: "experienced",
        employment_type: "FULL_TIME_WORKER",
        location: " 서울 ",
        last_verified_at: "invalid-date",
        required_skills: [],
        preferred_skills: [],
        unspecified_skills: [],
      },
      {
        ...base,
        id: "job-3",
        career_type: null,
        employment_type: null,
        location: null,
        last_verified_at: "2026-07-12T03:00:00Z",
        required_skills: [],
        preferred_skills: [],
        unspecified_skills: [],
      },
    ]);

    expect(snapshot.companyName).toBe("검증 기업");
    expect(snapshot.postingCount).toBe(3);
    expect(snapshot.uniqueSkillCount).toBe(3);
    expect(snapshot.locationCount).toBe(1);
    expect(snapshot.latestVerifiedAt).toBe("2026-07-14T03:00:00Z");
    expect(snapshot.careers).toEqual([
      { label: "경력", count: 2 },
      { label: "경력 미기재", count: 1 },
    ]);
    expect(snapshot.employmentTypes).toEqual([
      { label: "정규직", count: 2 },
      { label: "고용 형태 미기재", count: 1 },
    ]);
    expect(snapshot.locations).toEqual([
      { label: "서울", count: 2 },
      { label: "근무지 미기재", count: 1 },
    ]);
  });

  it("returns an empty honest snapshot without fabricating identity", () => {
    expect(buildCompanyHiringSnapshot([])).toEqual({
      companyName: null,
      postingCount: 0,
      uniqueSkillCount: 0,
      locationCount: 0,
      latestVerifiedAt: null,
      skills: [],
      careers: [],
      employmentTypes: [],
      locations: [],
    });
  });
});
