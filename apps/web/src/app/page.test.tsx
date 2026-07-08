import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";

import { DailyDashboardHome } from "@/components/dashboard/daily-dashboard-home";
import type { DailyDashboardModel } from "@/components/dashboard/types";
import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";


const navigationMocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));


vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
  getSkillGraph: vi.fn(),
  getSkillStats: vi.fn(),
}));


vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: navigationMocks.replace,
  }),
}));


function mockDashboardApi() {
  vi.mocked(getPostings).mockResolvedValue({
    total: 1,
    items: [
      {
        id: "job-1",
        title: "Backend Engineer",
        company_name: "토스",
        career_type: "experienced",
        employment_type: "FULL_TIME",
        career_min: 3,
        career_max: 7,
        location: "서울",
        status: "open",
        source_url: "https://example.com/job-1",
        last_verified_at: "2026-07-07T00:00:00.000Z",
      },
    ],
  });
  vi.mocked(getSkillStats).mockResolvedValue({
    total: 1,
    items: [
      {
        skill: "Kubernetes",
        category: "infra",
        count: 14,
        required_count: 8,
        preferred_count: 4,
        unspecified_count: 2,
      },
    ],
  });
  vi.mocked(getSkillGraph).mockResolvedValue({
    seed: "Java",
    nodes: [],
    edges: [],
    evidence: [
      {
        posting_id: "job-1",
        title: "Backend Engineer",
        company_name: "토스",
        skills: ["Java", "Spring", "AWS", "Kafka"],
        required: ["Java", "Spring"],
        preferred: ["Kafka"],
        unspecified: ["AWS"],
      },
    ],
    meta: {
      limit: 30,
      min_confidence: 0.8,
    },
  });
}


function dashboardModel(ownedSkills: string[]): DailyDashboardModel {
  return {
    mode: "personalized",
    ownedSkills,
    jobs: [
      {
        id: "job-remember",
        title: "Backend Engineer",
        companyName: "리멤버",
        location: "서울 강남",
        careerLabel: "경력",
        statusLabel: "진행 중",
        freshnessLabel: "2시간 전",
        sourceUrl: "https://example.com/remember",
        fitScore: 88,
        matchedSkills: ["Java", "Spring"],
        missingSkills: [],
        recommendationReasons: [],
        isSupplemental: false,
      },
      {
        id: "job-oliveyoung",
        title: "Frontend Engineer",
        companyName: "올리브영",
        location: "경기 성남",
        careerLabel: "신입",
        statusLabel: "진행 중",
        freshnessLabel: "7월 1일",
        sourceUrl: "https://example.com/oliveyoung",
        fitScore: 76,
        matchedSkills: ["React", "TypeScript"],
        missingSkills: [],
        recommendationReasons: [],
        isSupplemental: false,
      },
    ],
    summary: {
      matchedJobCount: 18,
      highFitJobCount: 7,
      gapSkillCount: 2,
      actionItemCount: 5,
    },
    trendingSkills: [],
    cooccurringSkills: [],
    updatedLabel: "방금 전",
  };
}


describe("Home", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("renders the weekly stack intelligence dashboard with the Ejikfit brand", async () => {
    mockDashboardApi();

    render(await Home());

    expect(screen.getByLabelText("이직핏 대시보드 홈")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "내 기술스택 기준 이번 주 요약" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("기술 채용 인텔리전스")).not.toBeInTheDocument();
    expect(screen.queryByText("Tech Hiring Intelligence")).not.toBeInTheDocument();
    expect(screen.getByLabelText("검색어")).toHaveAttribute(
      "placeholder",
      "기술, 직무, 기업을 검색하세요",
    );
    expect(screen.getByRole("combobox", { name: "지역" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "경력" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "기간" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "신규 매칭 공고" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "80% 이상 Fit" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "상승 기술" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "마감 임박" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "내 기술스택 기준 시장 변화" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "이번 주 신규 공고" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "급상승 관련 기술 TOP 5" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "변경 / 마감 임박 공고" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("내 기술 적합도")).not.toBeInTheDocument();
    expect(screen.queryByText("다음 액션")).not.toBeInTheDocument();
  });

  it("uses owned skills from URL params for the home graph request", async () => {
    mockDashboardApi();

    render(
      await Home({
        searchParams: Promise.resolve({
          owned_skills: ["React", "Go"],
        }),
      }),
    );

    expect(getSkillGraph).toHaveBeenCalledWith({
      seed: "Go",
      owned_skills: ["Go", "React"],
      limit: 30,
    });
    expect(screen.getByRole("button", { name: "Go 제거" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "React 제거" })).toBeInTheDocument();
  });

  it("persists edited owned skills and syncs the dashboard URL", () => {
    render(<DailyDashboardHome model={dashboardModel(["Java", "Spring"])} dataFailed={false} />);

    fireEvent.change(screen.getByLabelText("내 스택에 추가할 기술"), {
      target: { value: "Go" },
    });
    fireEvent.click(screen.getByRole("button", { name: "추가" }));

    expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills") ?? "[]")).toEqual([
      "Go",
      "Java",
      "Spring",
    ]);
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      "/?owned_skills=Go&owned_skills=Java&owned_skills=Spring#my-stack",
      { scroll: false },
    );

    fireEvent.click(screen.getByRole("button", { name: "Spring 제거" }));

    expect(JSON.parse(localStorage.getItem("ejik-fit:owned-skills") ?? "[]")).toEqual([
      "Go",
      "Java",
    ]);
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      "/?owned_skills=Go&owned_skills=Java#my-stack",
      { scroll: false },
    );
  });

  it("filters visible jobs by search text and dashboard selects", () => {
    render(<DailyDashboardHome model={dashboardModel(["Java", "Spring"])} dataFailed={false} />);

    fireEvent.change(screen.getByLabelText("검색어"), {
      target: { value: "리멤버" },
    });

    expect(screen.getByText("리멤버")).toBeInTheDocument();
    expect(screen.queryByText("올리브영")).not.toBeInTheDocument();
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      "/?q=%EB%A6%AC%EB%A9%A4%EB%B2%84#weekly-jobs",
      { scroll: false },
    );

    fireEvent.change(screen.getByLabelText("검색어"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("지역"), {
      target: { value: "gyeonggi" },
    });

    expect(screen.queryByText("리멤버")).not.toBeInTheDocument();
    expect(screen.getByText("올리브영")).toBeInTheDocument();
    expect(navigationMocks.replace).toHaveBeenLastCalledWith(
      "/?region=gyeonggi#weekly-jobs",
      { scroll: false },
    );
  });
});
