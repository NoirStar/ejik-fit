import { describe, expect, it } from "vitest";

import {
  EMPTY_CAREER_PROFILE,
  type CareerProfile,
} from "@/lib/career-profile";
import type { PostingSummary } from "@/lib/types";

import {
  CAREER_ANALYSIS_VERSION,
  buildCareerAnalysis,
} from "./model";

function job(
  id: string,
  title: string,
  description: string,
  skills: string[],
  overrides: Partial<PostingSummary> = {},
): PostingSummary {
  return {
    id,
    title,
    company_name: `${id} 기업`,
    company_slug: `${id}-company`,
    career_type: "experienced",
    employment_type: "FULL_TIME_WORKER",
    career_min: 3,
    career_max: 8,
    location: "서울",
    status: "open",
    source_url: `https://careers.example.com/${id}`,
    last_verified_at: "2026-07-30T09:00:00Z",
    description_excerpt: description,
    required_skills: skills,
    preferred_skills: [],
    unspecified_skills: [],
    ...overrides,
  };
}

const postings = [
  job(
    "backend",
    "Backend Platform Engineer",
    "결제 API를 개발하고 Kubernetes 기반 서비스의 배포와 장애 대응을 담당합니다.",
    ["Python", "Kubernetes", "Docker"],
  ),
  job(
    "security",
    "Cloud Security Engineer",
    "클라우드 보안 정책과 침해 탐지 자동화, 보안 사고 대응을 담당합니다.",
    ["Python", "Linux", "AWS"],
  ),
  job(
    "ai",
    "AI Engineer",
    "LLM 모델 학습과 추론 파이프라인을 개발합니다.",
    ["Python", "PyTorch", "Linux"],
  ),
];

function platformProfile(overrides: Partial<CareerProfile> = {}): CareerProfile {
  return {
    ...EMPTY_CAREER_PROFILE,
    currentRole: "플랫폼 엔지니어",
    pastRoles: ["백엔드 개발자"],
    experienceYears: 6,
    responsibilities: "Python API 개발, Kubernetes 플랫폼 운영, 배포 자동화와 장애 대응",
    workTypes: ["development", "operations", "automation"],
    industryExperience: ["핀테크"],
    currentDomain: "backend",
    keepExperience: "대규모 트래픽 서비스 운영과 자동화",
    excludedDomains: ["ai"],
    preferredLocations: ["서울"],
    employmentTypes: ["full_time"],
    careerLevel: "senior",
    skillUsage: {
      Python: { years: 6, lastUsed: "current" },
      Kubernetes: { years: 4, lastUsed: "current" },
      Linux: { years: 6, lastUsed: "current" },
    },
    ...overrides,
  };
}

describe("career analysis domain model", () => {
  it("produces one versioned deterministic result and excludes unwanted fields", () => {
    const input = {
      profile: platformProfile(),
      ownedSkills: ["Python", "Kubernetes", "Linux"],
      postings,
    };
    const first = buildCareerAnalysis(input);
    const second = buildCareerAnalysis(input);

    expect(first.version).toBe(CAREER_ANALYSIS_VERSION);
    expect(first.snapshotId).toBe(second.snapshotId);
    expect(first.calculatedAt).toBe("2026-07-30T09:00:00Z");
    expect(first.directions[0]).toMatchObject({
      domain: "backend",
      kind: "direct",
      representativeJob: { id: "backend" },
    });
    expect(first.directions.map((direction) => direction.domain)).not.toContain(
      "ai",
    );
    expect(first.jobConnections.ai.recommendationEligible).toBe(false);
  });

  it("uses responsibilities and structured achievements as career evidence", () => {
    const backend = buildCareerAnalysis({
      profile: platformProfile({ currentDomain: "" }),
      ownedSkills: ["Python", "Linux"],
      postings,
    });
    const security = buildCareerAnalysis({
      profile: platformProfile({
        currentDomain: "",
        currentRole: "엔지니어",
        pastRoles: [],
        responsibilities: "보안 정책 운영, 침해 탐지 자동화와 보안 사고 대응",
        experienceHighlights: [
          {
            title: "이상 징후 탐지 개선",
            responsibilities: "클라우드 로그 분석과 탐지 규칙 운영",
            outcome: "오탐 대응 절차를 정리했습니다.",
            domain: "security",
            skills: ["Linux", "Python"],
          },
        ],
      }),
      ownedSkills: ["Python", "Linux"],
      postings,
    });

    expect(backend.directions[0]?.domain).toBe("backend");
    expect(security.directions[0]?.domain).toBe("security");
    expect(security.jobConnections.security.evidenceTypes).toEqual(
      expect.arrayContaining(["responsibility", "achievement"]),
    );
  });

  it("does not recommend a job from one generic technology overlap", () => {
    const result = buildCareerAnalysis({
      profile: {
        ...EMPTY_CAREER_PROFILE,
        currentRole: "시스템 운영자",
        responsibilities: "리눅스 서버 운영과 장애 대응",
        workTypes: ["operations"],
      },
      ownedSkills: ["Linux"],
      postings: [postings[2]],
    });

    expect(result.jobConnections.ai).toMatchObject({
      recommendationEligible: false,
      connectionLevel: "limited",
      matchedSkills: ["Linux"],
    });
    expect(result.recommendedJobs).toEqual([]);
  });

  it("tracks which profile signals were used without turning unknown facts into deficits", () => {
    const result = buildCareerAnalysis({
      profile: platformProfile({
        experienceHighlights: [
          {
            title: "정산 API 안정화",
            responsibilities: "결제 API 장애 원인 분석과 배포 자동화",
            outcome: "반복 장애 대응 절차를 표준화했습니다.",
            domain: "backend",
            skills: ["Python", "Kubernetes"],
          },
        ],
      }),
      ownedSkills: ["Python", "Kubernetes", "Linux"],
      postings,
    });

    expect(result.profileEvidenceUsed).toEqual(
      expect.arrayContaining([
        "currentRole",
        "pastRoles",
        "responsibilities",
        "experienceHighlights",
        "workTypes",
        "industryExperience",
        "experienceYears",
        "skillUsage",
        "preferredLocations",
        "employmentTypes",
      ]),
    );
    expect(result.jobConnections.backend.unconfirmedConditions).not.toContain(
      "부족",
    );
  });
});
