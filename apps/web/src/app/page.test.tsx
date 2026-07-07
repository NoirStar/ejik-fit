import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";


vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
  getSkillGraph: vi.fn(),
  getSkillStats: vi.fn(),
}));


describe("Home", () => {
  it("renders a job-first daily dashboard and reveals missing skills only after selecting a job", async () => {
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
          skills: ["C++", "Python", "Kafka"],
          required: ["C++"],
          preferred: ["Kafka"],
          unspecified: ["Python"],
        },
      ],
      meta: {
        limit: 30,
        min_confidence: 0.8,
      },
    });

    render(await Home());

    expect(
      screen.getByRole("heading", { name: "기술 채용 인텔리전스" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "최근 맞춤 공고" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Kafka")).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "토스 Backend Engineer 상세 보기" }),
    );

    expect(screen.getByText("부족 기술")).toBeInTheDocument();
    expect(screen.getByText("Kafka")).toBeInTheDocument();
  });
});
