import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { analyzeFit, getPostings, getSkillGraph, getSkillStats } from "@/lib/api";

import Home from "./page";

vi.mock("@/lib/api", () => ({
  analyzeFit: vi.fn(),
  getPostings: vi.fn(),
  getSkillGraph: vi.fn(),
  getSkillStats: vi.fn(),
}));

function mockHomeApi() {
  vi.mocked(analyzeFit).mockResolvedValue({
    coverage: {
      matching_posting_count: 12,
      strong_fit_posting_count: 4,
    },
    domain_branches: [],
    recommended_next_skills: [
      {
        skill: "Kubernetes",
        reason: "보유 스킬과 함께 등장한 공고에서 8회 부족 요구사항으로 확인됨",
        required_count: 6,
        preferred_count: 2,
        supporting_posting_count: 8,
      },
    ],
  });
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
        source_url: "https://careers.toss.im/job-1",
        last_verified_at: "2026-07-12T15:00:00.000Z",
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
        skills: ["Java", "Spring", "Kafka"],
        required: ["Java", "Spring"],
        preferred: ["Kafka"],
        unspecified: [],
      },
    ],
    meta: { limit: 30, min_confidence: 0.8 },
  });
}

describe("Home", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.clearAllMocks();
    mockHomeApi();
  });

  it("renders mock community beside API-backed jobs and skill counts", async () => {
    render(
      await Home({
        searchParams: Promise.resolve({ owned_skills: ["Java", "Spring"] }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "내 커리어와 가까운 이야기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("article", { name: /3년차 백엔드 개발자/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    expect(screen.getAllByText("Kubernetes").length).toBeGreaterThan(0);
    expect(screen.getByText("필수 8건")).toBeInTheDocument();
    expect(screen.queryByText(/지난주 대비|합격 가능성|\d+\.\d+점/)).not.toBeInTheDocument();
    expect(getPostings).toHaveBeenCalledWith({ limit: 40 });
    expect(getSkillStats).toHaveBeenCalledWith({ limit: 8 });
    expect(getSkillGraph).toHaveBeenCalledWith({
      seed: "Java",
      owned_skills: ["Java", "Spring"],
      limit: 30,
    });
    expect(analyzeFit).toHaveBeenCalledWith({
      owned_skills: ["Java", "Spring"],
    });
    const insight = screen.getByRole("region", { name: "내 커리어 인사이트" });
    expect(insight).toHaveTextContent("12건");
    expect(insight).toHaveTextContent("Kubernetes");
  });

  it("applies the saved career scope to each supported actual-data API", async () => {
    render(
      await Home({
        searchParams: Promise.resolve({
          owned_skills: "Java",
          career_type: "experienced",
          target_domain: "backend",
        }),
      }),
    );

    expect(getPostings).toHaveBeenCalledWith({
      career_type: "experienced",
      limit: 40,
    });
    expect(getSkillStats).toHaveBeenCalledWith({
      career_type: "experienced",
      limit: 8,
    });
    expect(getSkillGraph).toHaveBeenCalledWith({
      seed: "Java",
      owned_skills: ["Java"],
      career_type: "experienced",
      limit: 30,
    });
    expect(analyzeFit).toHaveBeenCalledWith({
      owned_skills: ["Java"],
      career_type: "experienced",
      domains: ["backend"],
    });

    const context = screen.getByRole("region", { name: "내 관심 시장" });
    expect(within(context).getByText("경력 · 백엔드")).toBeInTheDocument();
    expect(within(context).getByText("내 기술 1개")).toBeInTheDocument();
    expect(within(context).getByRole("link", { name: "조건 수정" }))
      .toHaveAttribute("href", "/career");
  });

  it("does not inject default skills for a first visit", async () => {
    render(await Home());

    expect(getSkillGraph).toHaveBeenCalledWith({
      owned_skills: [],
      limit: 30,
    });
    expect(analyzeFit).not.toHaveBeenCalled();
    expect(screen.getByText("내 스택을 추가하면 일치 공고를 계산합니다.")).toBeInTheDocument();
    expect(screen.getByText("내 스택을 추가하면 현재 공개 공고와 비교할 수 있어요."))
      .toBeInTheDocument();
    const context = screen.getByRole("region", { name: "내 관심 시장" });
    expect(context).toHaveTextContent("전체 경력 · 전체 기술 분야");
    expect(within(context).getByRole("link", { name: "조건 설정" }))
      .toHaveAttribute("href", "/career");
    expect(screen.queryByText("내 기술 Java")).not.toBeInTheDocument();
  });

  it("keeps successful data visible when a resource fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getSkillGraph).mockRejectedValue(new Error("graph offline"));

    render(await Home());

    expect(screen.getByText("일부 실데이터를 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    expect(screen.getByText("스킬 연결 데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.queryByText("graph offline")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "데이터 다시 불러오기" })).toBeInTheDocument();
    expect(log).toHaveBeenCalledWith(
      "[resource] request failed",
      expect.any(Error),
    );
    log.mockRestore();
  });

  it("keeps the home usable when only personalized comparison fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(analyzeFit).mockRejectedValue(new Error("fit offline"));

    render(
      await Home({
        searchParams: Promise.resolve({ owned_skills: "Java" }),
      }),
    );

    expect(screen.getByText("일부 실데이터를 불러오지 못했습니다"))
      .toBeInTheDocument();
    const insight = screen.getByRole("region", { name: "내 커리어 인사이트" });
    expect(insight).toHaveTextContent("현재 커리어 비교를 불러오지 못했습니다.");
    expect(insight).not.toHaveTextContent(/\d+건/);
    expect(screen.getByText("토스")).toBeInTheDocument();
    log.mockRestore();
  });

  it("opens the composer from the shell write query", async () => {
    render(
      await Home({
        searchParams: Promise.resolve({ compose: "1" }),
      }),
    );

    expect(
      screen.getByRole("dialog", { name: "커뮤니티 글쓰기" }),
    ).toBeInTheDocument();
  });
});
