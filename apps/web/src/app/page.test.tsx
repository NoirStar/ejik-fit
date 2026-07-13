import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";

import Home from "./page";

vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
  getSkillGraph: vi.fn(),
  getSkillStats: vi.fn(),
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
    mockDashboardApi();
  });

  it("renders the honest dashboard from API responses", async () => {
    render(
      await Home({
        searchParams: Promise.resolve({ owned_skills: ["Java", "Spring"] }),
      }),
    );

    expect(screen.getByRole("heading", { name: "오늘의 공식 채용 신호" })).toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.queryByText("지난주 대비")).not.toBeInTheDocument();
    expect(getPostings).toHaveBeenCalledWith({ limit: 100 });
    expect(getSkillGraph).toHaveBeenCalledWith({
      seed: "Java",
      owned_skills: ["Java", "Spring"],
      limit: 30,
    });
  });

  it("does not inject default skills for a first visit", async () => {
    render(await Home());

    expect(getSkillGraph).toHaveBeenCalledWith({
      owned_skills: [],
      limit: 30,
    });
    expect(screen.getByText("내 스택을 추가하면 일치 공고를 계산합니다.")).toBeInTheDocument();
    expect(screen.queryByText("Java")).not.toBeInTheDocument();
  });

  it("keeps successful data visible when a resource fails", async () => {
    vi.mocked(getSkillGraph).mockRejectedValue(new Error("graph offline"));

    render(await Home());

    expect(screen.getByText("일부 데이터를 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    expect(screen.getByText("graph offline")).toBeInTheDocument();
  });
});
