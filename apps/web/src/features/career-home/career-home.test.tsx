import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { writeCareerProfile } from "@/lib/career-profile";
import type { HomeFeedSnapshot } from "@/features/home-feed/types";
import type { PostingSummary } from "@/lib/types";

import { CareerHome } from "./career-home";

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
  last_verified_at: "2026-07-29T08:00:00.000Z",
  description_excerpt: "결제 API를 개발하고 서비스 운영과 배포 자동화를 담당합니다.",
  required_skills: ["Java", "Spring"],
  preferred_skills: ["Kafka"],
  unspecified_skills: [],
};

const baseSnapshot: HomeFeedSnapshot = {
  dataStatus: "ready",
  feedItems: [],
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
  personalizationFallback: false,
  postingCount: 18,
  sourceCount: 5,
  lastVerifiedAt: "2026-07-29T08:00:00.000Z",
  resourceErrors: [],
  analysisPostings: [],
};

describe("CareerHome", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("explains the product and next action before a profile exists", () => {
    render(<CareerHome snapshot={baseSnapshot} />);

    expect(
      screen.getByRole("link", { name: "내 커리어 분석하기" }),
    ).toHaveAttribute("href", "/career");
    expect(screen.getByRole("heading", {
      name: "내 경험에서 이어갈 커리어 방향을 확인하세요",
    })).toBeInTheDocument();
    expect(screen.getByText("결과에서 확인할 내용")).toBeInTheDocument();
    expect(screen.getByText(/공식 채용공고 18건/)).toBeInTheDocument();
    expect(screen.queryByText(/01|02|03/)).not.toBeInTheDocument();
  });

  it("puts a profiled user's conclusion, evidence, market and job in that order", async () => {
    writeCareerProfile({
      currentRole: "백엔드 개발자",
      pastRoles: [],
      experienceYears: 5,
      responsibilities: "결제 API 개발과 운영 자동화",
      experienceHighlights: [],
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
          analysisPostings: [backendPosting],
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
              firstSeenAt: null,
              verifiedLabel: "7월 29일",
              requiredSkills: ["Java", "Spring"],
              preferredSkills: ["Kafka"],
              unspecifiedSkills: [],
              matchedRequiredSkills: ["Java"],
              missingRequiredSkills: ["Spring"],
              matchedPreferredSkills: ["Kafka"],
              matchedUnspecifiedSkills: [],
              recommendationReason: "내 기술 2개 일치",
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
    expect(screen.getAllByText("직접 이어지는 방향").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1건").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1곳").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/결제 API|백엔드 개발자/).length).toBeGreaterThan(0);
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
      "채용공고를 불러오지 못했습니다",
    );
    expect(
      screen.getByRole("link", { name: "채용공고 다시 불러오기" }),
    ).toHaveAttribute("href", "/");
  });

  it("does not turn a partial fetch failure into a zero-posting claim", () => {
    render(
      <CareerHome
        snapshot={{
          ...baseSnapshot,
          dataStatus: "partial",
          postingCount: 0,
          sourceCount: 0,
          lastVerifiedAt: null,
          resourceErrors: ["공고 데이터를 불러오지 못했습니다."],
        }}
      />,
    );

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/채용공고 분석 범위를 불러오지 못했습니다/))
      .toBeInTheDocument();
    expect(screen.queryByText(/공식 채용공고 0건/)).not.toBeInTheDocument();
  });
});
