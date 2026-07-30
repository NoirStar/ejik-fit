import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { writeCareerProfile } from "@/lib/career-profile";
import type { HomeFeedSnapshot } from "@/features/home-feed/types";

import { CareerHome } from "./career-home";

const baseSnapshot: HomeFeedSnapshot = {
  dataStatus: "ready",
  feedItems: [],
  starterGuideItems: [],
  recommendedJobs: [],
  marketInsights: [],
  skillDemand: [],
  careerInsight: { status: "needs_skills" },
  careerContext: {
    careerCondition: "",
    careerConditionLabel: "전체",
    targetDomain: "",
    targetDomainLabel: "전체 분야",
    configured: false,
  },
  careerDirections: [],
  ownedSkills: [],
  postingCount: 18,
  sourceCount: 5,
  lastVerifiedAt: "2026-07-29T08:00:00.000Z",
  resourceErrors: [],
};

describe("CareerHome", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("explains the product and next action before a profile exists", () => {
    render(<CareerHome snapshot={baseSnapshot} />);

    expect(
      screen.getByRole("heading", {
        name: "내 경력과 기술이 이어지는 커리어 방향을 확인하세요",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "내 커리어 분석하기" }),
    ).toHaveAttribute("href", "/career");
    expect(screen.getByText("경력과 기술 입력")).toBeInTheDocument();
    expect(screen.getByText("커리어 방향과 연결 근거 확인")).toBeInTheDocument();
    expect(screen.getByText("관련 채용공고와 시장 확인")).toBeInTheDocument();
    expect(screen.getByText(/공개 채용공고 18건/)).toBeInTheDocument();
  });

  it("puts a profiled user's conclusion, evidence, market and job in that order", async () => {
    writeCareerProfile({
      currentRole: "백엔드 개발자",
      pastRoles: [],
      experienceYears: 5,
      responsibilities: "결제 API 개발과 운영 자동화",
      workTypes: ["development", "operations"],
      industryExperience: ["핀테크"],
      currentDomain: "backend",
      keepExperience: "대규모 트래픽 서비스 운영",
      interestDomains: [],
      excludedDomains: [],
      preferredLocations: ["서울"],
      employmentTypes: ["full_time"],
      careerLevel: "mid",
      skillUsage: {},
    });

    render(
      <CareerHome
        snapshot={{
          ...baseSnapshot,
          ownedSkills: ["Java", "Kafka"],
          careerInsight: {
            status: "ready",
            matchingPostingCount: 12,
            strongFitPostingCount: 4,
            nextSkill: null,
          },
          careerDirections: [
            {
              domain: "backend",
              label: "백엔드",
              coveredSkills: ["Java", "Kafka"],
              additionalRequirements: ["Spring"],
              postingCount: 12,
              confirmedCompanyCount: 3,
              representativeJob: {
                id: "job-1",
                title: "Backend Engineer",
                companyName: "토스",
                href: "/jobs/job-1",
              },
            },
          ],
          recommendedJobs: [
            {
              id: "job-job-1",
              postingId: "job-1",
              type: "recommended_job",
              companyName: "토스",
              title: "Backend Engineer",
              location: "서울",
              careerLabel: "경력",
              employmentLabel: "정규직",
              sourceUrl: "https://careers.toss.im/job-1",
              verifiedLabel: "7월 29일",
              matchedRequiredSkills: ["Java"],
              missingRequiredSkills: ["Spring"],
              matchedPreferredSkills: ["Kafka"],
              href: "/jobs/job-1",
              source: "api",
            },
          ],
        }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("경력 기준 분석")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("heading", { name: "백엔드 개발자 경험에서 이어갈 방향" }),
    ).toBeInTheDocument();
    expect(screen.getByText("현재 경력을 직접 이어가는 방향")).toBeInTheDocument();
    expect(screen.getByText("공고 12건")).toBeInTheDocument();
    expect(screen.getByText("확인된 기업 3곳")).toBeInTheDocument();
    expect(screen.getAllByText(/Java, Kafka/).length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole("link", { name: /Backend Engineer/ })) {
      expect(link).toHaveAttribute("href", "/jobs/job-1");
    }
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("keeps a useful route available when verified data fails", () => {
    render(
      <CareerHome
        snapshot={{
          ...baseSnapshot,
          dataStatus: "error",
          postingCount: 0,
          sourceCount: 0,
          lastVerifiedAt: null,
          resourceErrors: ["공고 데이터를 불러오지 못했습니다."],
        }}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "채용공고와 시장 데이터를 불러오지 못했습니다",
    );
    expect(
      screen.getByRole("link", { name: "전체 채용공고 직접 보기" }),
    ).toHaveAttribute("href", "/jobs");
  });
});
