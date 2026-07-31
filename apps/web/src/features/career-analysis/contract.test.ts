import { describe, expect, it } from "vitest";

import { EMPTY_CAREER_PROFILE } from "@/lib/career-profile";

import { careerAnalysisRequest, normalizeCareerAnalysis } from "./contract";
import { careerAnalysisFixture } from "./test-fixture";

const posting = {
  id: "job-1",
  title: "Backend Engineer",
  company_name: "검증 기업",
  company_slug: "verified-company",
  career_type: "experienced",
  employment_type: "FULL_TIME_WORKER",
  career_min: 3,
  career_max: null,
  location: "서울",
  status: "open",
  source_url: "https://example.com/job-1",
  last_verified_at: "2026-07-31T00:00:00Z",
  required_skills: ["Java"],
  preferred_skills: [],
  unspecified_skills: [],
};

describe("career analysis contract", () => {
  it("maps every saved profile signal to the server contract", () => {
    const request = careerAnalysisRequest({
      ...EMPTY_CAREER_PROFILE,
      currentRole: "백엔드 엔지니어",
      responsibilities: "결제 API 개발",
      experienceHighlights: [{
        title: "결제 안정화",
        responsibilities: "장애 원인 분석",
        outcome: "복구 절차 표준화",
        domain: "backend",
        skills: ["Java"],
      }],
      skillUsage: { Java: { years: 4, lastUsed: "current" } },
    }, ["Java"], { direction: "backend", limit: 5, offset: 10 });

    expect(request.profile.current_role).toBe("백엔드 엔지니어");
    expect(request.profile.experience_highlights[0]?.outcome).toBe("복구 절차 표준화");
    expect(request.profile.skill_usage.Java).toEqual({ years: 4, last_used: "current" });
    expect(request).toMatchObject({ direction: "backend", limit: 5, offset: 10 });
  });

  it("normalizes recommendation postings and rejects unsafe official links", () => {
    expect(normalizeCareerAnalysis(careerAnalysisFixture([posting])).recommendations.total)
      .toBe(1);
    expect(() => normalizeCareerAnalysis(careerAnalysisFixture([
      { ...posting, source_url: "javascript:alert(1)" },
    ]))).toThrow();
  });
});
