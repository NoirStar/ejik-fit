import { describe, expect, it } from "vitest";

import type { PostingSummary } from "@/lib/types";
import { EMPTY_CAREER_PROFILE } from "@/lib/career-profile";

import {
  buildJobEvidence,
  buildJobConnection,
  buildJobsSummary,
  filterJobPostings,
  formatCareerRange,
  formatClosingDate,
  formatDiscoveredDate,
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

  it("explains a direct role connection without a fabricated fit score", () => {
    expect(
      buildJobConnection(posting, ["python", "Kubernetes"], {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "Platform Engineer",
        responsibilities: "플랫폼 운영 자동화와 배포 환경을 담당했습니다.",
      }),
    ).toEqual({
      label: "현재 경력과 직접 이어짐",
      reason: "Platform Engineer 직무 경험이 DevOps·플랫폼 공고의 역할과 이어집니다.",
      matchedSkills: ["Python", "Kubernetes"],
      unconfirmedRequiredSkills: ["Docker"],
      extractedSkillCount: 4,
      directionId: "devops",
      directionLabel: "DevOps·플랫폼",
      recommendationEligible: true,
      evidenceTypes: ["role", "responsibility", "skill"],
    });
  });

  it("marks one overlap among many requirements as only a partial connection", () => {
    const manyRequirements = {
      ...posting,
      title: "Infrastructure Engineer",
      required_skills: ["Linux", "AWS", "Go", "Python", "Kubernetes", "Docker", "Terraform", "Ansible"],
      preferred_skills: [],
      unspecified_skills: [],
    };

    const connection = buildJobConnection(
      manyRequirements,
      ["Linux"],
      EMPTY_CAREER_PROFILE,
    );

    expect(connection.label).toBe("기술 일부만 확인됨");
    expect(connection.reason).toBe(
      "Linux 한 항목이 겹치지만 공고의 역할·업무와 이어지는 근거는 확인되지 않았습니다.",
    );
    expect(connection.recommendationEligible).toBe(false);
    expect(connection.unconfirmedRequiredSkills).toHaveLength(7);
    expect(connection).not.toHaveProperty("score");
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
    expect(filterJobPostings([posting, other], "matched", ["Python"], [])).toEqual([]);
    expect(filterJobPostings([posting, other], "saved", [], ["job-2"])).toEqual([
      other,
    ]);
  });

  it("does not recommend from a role title alone", () => {
    expect(
      filterJobPostings([posting], "matched", [], [], {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "Platform Engineer",
      }),
    ).toEqual([]);
    expect(
      buildJobConnection(posting, [], {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "Platform Engineer",
      }),
    ).toMatchObject({
      label: "추가 확인이 필요한 공고",
      recommendationEligible: false,
    });
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
    expect(formatDiscoveredDate("2026-07-10T03:00:00Z")).toBe(
      "7월 10일 처음 확인",
    );
    expect(formatDiscoveredDate("invalid")).toBeNull();
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

  it("counts a company once when its stable slug has multiple display names", () => {
    expect(
      buildJobsSummary([
        { ...posting, company_name: "검증 기업", company_slug: "verified" },
        {
          ...posting,
          id: "job-2",
          company_name: "검증기업 주식회사",
          company_slug: "verified",
        },
      ]).companyCount,
    ).toBe(1);
  });
});
