import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { analyzeFit, getPostings, getSkillGraph, getSkillStats } from "@/lib/api";

import Home, { metadata } from "./page";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => navigation,
}));

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
        reason: "보유 기술과 같은 공고 8건에서 추가 요구사항으로 확인됨",
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

  it("uses the full CareerFit browser title in the root route", () => {
    expect(metadata.title).toEqual({
      absolute: "커리어핏 | 경력과 채용공고를 연결하는 커리어 분석",
    });
  });

  it("renders career conclusions and API-backed jobs without a social feed", async () => {
    render(
      await Home({
        searchParams: Promise.resolve({ owned_skills: ["Java", "Spring"] }),
      }),
    );

    expect(
      screen.getByRole("heading", { name: "입력한 기술에서 이어갈 커리어 방향" }),
    ).toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "둘러보기" })).not.toBeInTheDocument();
    expect(screen.queryByText("커리어 커뮤니티 가이드")).not.toBeInTheDocument();
    expect(screen.queryByText(/지난주 대비|합격 가능성|\d+\.\d+점/)).not.toBeInTheDocument();
    expect(getPostings).toHaveBeenCalledWith({ limit: 40 });
    expect(getSkillStats).toHaveBeenCalledWith({ limit: 8 });
    expect(getSkillGraph).toHaveBeenCalledWith({
      seed: "Java",
      include_evidence: true,
      owned_skills: ["Java", "Spring"],
      limit: 30,
    });
    expect(analyzeFit).toHaveBeenCalledWith({
      owned_skills: ["Java", "Spring"],
    });
    expect(screen.getByText("기술 기준 분석")).toBeInTheDocument();
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
      include_evidence: true,
      owned_skills: ["Java"],
      career_type: "experienced",
      limit: 30,
    });
    expect(analyzeFit).toHaveBeenCalledWith({
      owned_skills: ["Java"],
      career_type: "experienced",
      domains: ["backend"],
    });

    expect(
      screen.getByRole("heading", { name: "입력한 기술에서 이어갈 커리어 방향" }),
    ).toBeInTheDocument();
  });

  it("does not inject default skills for a first visit", async () => {
    render(await Home());

    expect(getSkillGraph).toHaveBeenCalledWith({
      include_evidence: true,
      owned_skills: [],
      limit: 30,
    });
    expect(analyzeFit).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", {
        name: "내 경력과 기술이 이어지는 커리어 방향을 확인하세요",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 커리어 분석하기" }))
      .toHaveAttribute("href", "/career");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
  });

  it("keeps successful data visible when a resource fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getSkillGraph).mockRejectedValue(new Error("graph offline"));

    render(await Home());

    expect(screen.getByText("일부 데이터를 불러오지 못해 확인된 결과만 표시합니다."))
      .toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    expect(screen.queryByText("graph offline")).not.toBeInTheDocument();
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

    expect(screen.getByText("일부 데이터를 불러오지 못해 확인된 결과만 표시합니다."))
      .toBeInTheDocument();
    expect(screen.getByText("현재 입력으로 연결되는 분야를 확인하지 못했습니다"))
      .toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    log.mockRestore();
  });

  it("does not mix the community composer into home", async () => {
    render(
      await Home({
        searchParams: Promise.resolve({ compose: "1" }),
      }),
    );

    expect(screen.queryByRole("dialog", { name: "커뮤니티 글쓰기" }))
      .not.toBeInTheDocument();
  });
});
