import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_CAREER_PROFILE,
  careerAnalysisLevel,
  clearCareerProfile,
  normalizeCareerProfile,
  readCareerProfile,
  subscribeCareerProfile,
  writeCareerProfile,
} from "./career-profile";

describe("career profile storage", () => {
  afterEach(() => localStorage.clear());

  it("normalizes progressive career fields without inventing missing details", () => {
    expect(
      normalizeCareerProfile({
        currentRole: "  백엔드 개발자  ",
        pastRoles: [" 서버 개발자 ", "서버 개발자", 42],
        experienceYears: 7.5,
        responsibilities: "  결제 API 운영과 장애 대응  ",
        workTypes: ["development", "operations", "unknown"],
        industryExperience: [" 핀테크 ", "커머스"],
        currentDomain: "backend",
        keepExperience: "대규모 트래픽 운영",
        interestDomains: ["security", "cloud", "security"],
        excludedDomains: ["game", "<script>"],
        preferredLocations: ["서울", "경기"],
        employmentTypes: ["full_time", "contract", "invalid"],
        careerLevel: "senior",
        skillUsage: {
          Python: { years: 6, lastUsed: "current" },
          "": { years: 1, lastUsed: "within_1y" },
        },
      }),
    ).toEqual({
      currentRole: "백엔드 개발자",
      pastRoles: ["서버 개발자"],
      experienceYears: 7.5,
      responsibilities: "결제 API 운영과 장애 대응",
      workTypes: ["development", "operations"],
      industryExperience: ["핀테크", "커머스"],
      currentDomain: "backend",
      keepExperience: "대규모 트래픽 운영",
      interestDomains: ["cloud", "security"],
      excludedDomains: ["game"],
      preferredLocations: ["서울", "경기"],
      employmentTypes: ["full_time", "contract"],
      careerLevel: "senior",
      skillUsage: {
        Python: { years: 6, lastUsed: "current" },
      },
    });
  });

  it("distinguishes a skill-only analysis from a career-based analysis", () => {
    expect(careerAnalysisLevel(EMPTY_CAREER_PROFILE)).toBe("기술 기준 분석");
    expect(
      careerAnalysisLevel({
        ...EMPTY_CAREER_PROFILE,
        currentRole: "플랫폼 엔지니어",
        responsibilities: "배포 자동화와 운영",
      }),
    ).toBe("경력 기준 분석");
  });

  it("migrates a legacy profile and keeps both generations compatible", () => {
    localStorage.setItem(
      "ejik-fit:career-profile",
      JSON.stringify({ currentRole: "보안 엔지니어", workTypes: ["operations"] }),
    );

    expect(readCareerProfile().currentRole).toBe("보안 엔지니어");
    expect(localStorage.getItem("careerfit:career-profile")).toContain(
      "보안 엔지니어",
    );

    writeCareerProfile({
      ...EMPTY_CAREER_PROFILE,
      currentRole: "클라우드 보안 엔지니어",
    });
    expect(localStorage.getItem("careerfit:career-profile")).toContain(
      "클라우드 보안 엔지니어",
    );
    expect(localStorage.getItem("ejik-fit:career-profile")).toContain(
      "클라우드 보안 엔지니어",
    );
  });

  it("notifies subscribers and clears both branded keys", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCareerProfile(listener);

    writeCareerProfile({
      ...EMPTY_CAREER_PROFILE,
      currentRole: "데이터 엔지니어",
    });
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ currentRole: "데이터 엔지니어" }),
    );

    clearCareerProfile();
    expect(localStorage.getItem("careerfit:career-profile")).toBeNull();
    expect(localStorage.getItem("ejik-fit:career-profile")).toBeNull();
    unsubscribe();
  });
});
