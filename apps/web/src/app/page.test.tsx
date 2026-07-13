import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";

import Home from "./page";

vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
  getSkillGraph: vi.fn(),
  getSkillStats: vi.fn(),
}));

function mockHomeApi() {
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
  });

  it("does not inject default skills for a first visit", async () => {
    render(await Home());

    expect(getSkillGraph).toHaveBeenCalledWith({
      owned_skills: [],
      limit: 30,
    });
    expect(screen.getByText("내 스택을 추가하면 일치 공고를 계산합니다.")).toBeInTheDocument();
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
      "[home-feed] resource request failed",
      expect.any(Error),
    );
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
