import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HomeFeedSnapshot } from "@/features/home-feed/types";
import { writeCareerProfile } from "@/lib/career-profile";
import { writeOwnedSkills } from "@/lib/owned-skills";
import { careerAnalysisFixture } from "@/features/career-analysis/test-fixture";
import type { PostingSummary } from "@/lib/types";

import { CareerMap } from "./career-map";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams("owned_skills=Java"),
}));

const backendPosting: PostingSummary = {
  id: "job-1",
  title: "Backend Engineer",
  company_name: "토스",
  company_slug: "toss",
  career_type: "experienced",
  employment_type: "FULL_TIME_WORKER",
  career_min: 3,
  career_max: 8,
  location: "서울",
  status: "open",
  source_url: "https://careers.example.com/job-1",
  last_verified_at: "2026-07-29T00:00:00.000Z",
  description_excerpt: "API를 개발하고 서비스 운영과 배포 자동화를 담당합니다.",
  required_skills: ["Java", "Spring"],
  preferred_skills: ["Kafka"],
  unspecified_skills: [],
};

const snapshot: HomeFeedSnapshot = {
  dataStatus: "ready",
  feedItems: [],
  recommendedJobs: [],
  marketInsights: [],
  skillDemand: [],
  careerInsight: {
    status: "ready",
    matchingPostingCount: 9,
    strongFitPostingCount: 3,
    nextSkill: null,
  },
  careerContext: {
    careerCondition: "experienced",
    careerConditionLabel: "경력",
    targetDomain: "backend",
    targetDomainLabel: "백엔드",
    configured: true,
  },
  careerDirections: [
    {
      domain: "backend",
      label: "백엔드",
      coveredSkills: ["Java", "Kafka"],
      additionalRequirements: ["Spring"],
      postingCount: 9,
      confirmedCompanyCount: 4,
      representativeJob: {
        id: "job-1",
        title: "Backend Engineer",
        companyName: "토스",
        href: "/jobs/job-1",
      },
    },
  ],
  ownedSkills: ["Java"],
  personalizationFallback: false,
  postingCount: 20,
  sourceCount: 6,
  lastVerifiedAt: "2026-07-29T00:00:00.000Z",
  resourceErrors: [],
  analysisPostings: [backendPosting],
};

describe("CareerMap", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(careerAnalysisFixture([backendPosting]))));
  });
  afterEach(() => {
    cleanup();
    localStorage.clear();
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
    vi.unstubAllGlobals();
  });

  it("compares evidence-backed directions in a list and detail panel", async () => {
    writeOwnedSkills(["Java"]);
    writeCareerProfile({
      currentRole: "백엔드 개발자",
      pastRoles: [],
      experienceYears: 5,
      responsibilities: "API 개발과 운영",
      experienceHighlights: [],
      workTypes: ["development", "operations"],
      industryExperience: [],
      currentDomain: "backend",
      keepExperience: "",
      interestDomains: [],
      excludedDomains: [],
      preferredLocations: [],
      employmentTypes: [],
      careerLevel: "mid",
      skillUsage: {},
    });

    render(<CareerMap snapshot={snapshot} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /백엔드/ })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "커리어 방향 비교" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /백엔드/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByText("직접 이어지는 방향").length)
      .toBeGreaterThan(0);
    expect(screen.getAllByText("1건").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1곳").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Java/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /대표 공고: 토스 · Backend Engineer/ }))
      .toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByRole("link", { name: "기술 관계 보기" }))
      .toHaveAttribute("href", "/skills/graph");
    expect(screen.getByText(/커리어 경로나 학습 순서가 아닙니다/))
      .toBeInTheDocument();
  });

  it("explains the empty state and next action without fabricating a map", () => {
    localStorage.clear();
    render(
      <CareerMap
        snapshot={{
          ...snapshot,
          careerDirections: [],
          careerInsight: { status: "needs_skills" },
          careerContext: {
            careerCondition: "",
            careerConditionLabel: "전체",
            targetDomain: "",
            targetDomainLabel: "전체 분야",
            configured: false,
          },
          ownedSkills: [],
        }}
      />,
    );

    expect(screen.getByText("커리어 방향을 비교할 정보가 아직 없습니다."))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "커리어 프로필 입력" }))
      .toHaveAttribute("href", "/career");
  });
});
