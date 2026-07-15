import { describe, expect, it } from "vitest";

import type { PostingSummary } from "@/lib/types";

import {
  buildJobEvidence,
  buildJobsSummary,
  filterJobPostings,
  formatCareerRange,
  formatClosingDate,
  formatVerifiedDate,
} from "./model";

const posting: PostingSummary = {
  id: "job-1",
  title: "Platform Engineer",
  company_name: "검증 기업",
  career_type: "experienced",
  employment_type: "FULL_TIME_WORKER",
  career_min: 3,
  career_max: 7,
  location: "서울",
  status: "open",
  source_url: "https://careers.example.com/job-1",
  last_verified_at: "2026-07-14T03:00:00Z",
  opens_at: "2026-07-01T00:00:00Z",
  closes_at: "2026-07-31T00:00:00Z",
  required_skills: ["Python", "Docker"],
  preferred_skills: ["Kubernetes"],
  unspecified_skills: ["Linux", "Python"],
};

describe("jobs explorer model", () => {
  it("builds case-insensitive overlap from confirmed requirement groups", () => {
    expect(buildJobEvidence(posting, ["python", "Kubernetes"])).toEqual({
      matchedSkills: ["Python", "Kubernetes"],
      requiredSkills: ["Python", "Docker"],
      preferredSkills: ["Kubernetes"],
      unspecifiedSkills: ["Linux"],
      extractedSkillCount: 4,
    });
  });

  it("filters all, matching and browser-saved result views", () => {
    const other = {
      ...posting,
      id: "job-2",
      company_name: "다른 기업",
      required_skills: ["Go"],
      preferred_skills: [],
      unspecified_skills: [],
    };

    expect(filterJobPostings([posting, other], "all", ["Python"], [])).toHaveLength(2);
    expect(filterJobPostings([posting, other], "matched", ["Python"], [])).toEqual([
      posting,
    ]);
    expect(filterJobPostings([posting, other], "saved", [], ["job-2"])).toEqual([
      other,
    ]);
  });

  it("formats only declared career ranges", () => {
    expect(formatCareerRange(posting)).toBe("경력 3~7년");
    expect(
      formatCareerRange({ ...posting, career_min: 7, career_max: null }),
    ).toBe("경력 7년 이상");
    expect(
      formatCareerRange({ ...posting, career_type: "new_comer", career_min: null }),
    ).toBe("신입");
    expect(
      formatCareerRange({
        ...posting,
        career_type: "not_matter",
        career_min: null,
        career_max: null,
      }),
    ).toBe("경력 무관");
  });

  it("formats verified and closing dates without inventing missing values", () => {
    expect(formatVerifiedDate(posting.last_verified_at)).toBe("7월 14일 확인");
    expect(formatVerifiedDate("invalid")).toBe("확인일 미상");
    expect(formatClosingDate(posting.closes_at)).toBe("7월 31일 마감");
    expect(formatClosingDate(null)).toBeNull();
  });

  it("summarizes only the loaded API result set", () => {
    expect(
      buildJobsSummary([
        posting,
        { ...posting, id: "job-2", company_name: "다른 기업" },
        { ...posting, id: "job-3", last_verified_at: "invalid" },
      ]),
    ).toEqual({
      postingCount: 3,
      companyCount: 2,
      latestVerifiedLabel: "7월 14일",
    });
  });
});
