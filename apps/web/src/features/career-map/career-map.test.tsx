import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HomeFeedSnapshot } from "@/features/home-feed/types";
import { writeCareerProfile } from "@/lib/career-profile";
import { writeOwnedSkills } from "@/lib/owned-skills";

import { CareerMap } from "./career-map";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
  useSearchParams: () => new URLSearchParams("owned_skills=Java"),
}));

const snapshot: HomeFeedSnapshot = {
  dataStatus: "ready",
  feedItems: [],
  starterGuideItems: [],
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
  postingCount: 20,
  sourceCount: 6,
  lastVerifiedAt: "2026-07-29T00:00:00.000Z",
  resourceErrors: [],
};

describe("CareerMap", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    navigation.replace.mockReset();
    navigation.refresh.mockReset();
  });

  it("places the current profile at the center and opens evidence-backed directions", async () => {
    writeOwnedSkills(["Java"]);
    writeCareerProfile({
      currentRole: "백엔드 개발자",
      pastRoles: [],
      experienceYears: 5,
      responsibilities: "API 개발과 운영",
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
      expect(screen.getByText("백엔드 개발자")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "커리어맵" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /백엔드/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getAllByText("현재 경력을 직접 이어가는 방향").length)
      .toBeGreaterThan(0);
    expect(screen.getByText("관련 공고 9건")).toBeInTheDocument();
    expect(screen.getByText("확인된 기업 4곳")).toBeInTheDocument();
    expect(screen.getByText(/Java, Kafka/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "토스 · Backend Engineer" }))
      .toHaveAttribute("href", "/jobs/job-1");
    expect(screen.getByRole("link", { name: "기술 관계 보기" }))
      .toHaveAttribute("href", "/skills/graph");
    expect(screen.getByText(/커리어 경로나 학습 순서를 뜻하지 않습니다/))
      .toBeInTheDocument();
  });

  it("explains the empty state and next action without fabricating a map", () => {
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

    expect(screen.getByText("커리어맵을 만들 정보가 아직 없습니다"))
      .toBeInTheDocument();
    expect(screen.getByRole("link", { name: "커리어 프로필 입력" }))
      .toHaveAttribute("href", "/career");
  });
});
