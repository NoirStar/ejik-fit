import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings, getSkillGraph, getSkillStats } from "@/lib/api";

import MarketPage from "./page";

vi.mock("@/lib/api", () => ({
  SKILL_GRAPH_MAX_LIMIT: 60,
  getPostings: vi.fn(),
  getSkillGraph: vi.fn(),
  getSkillStats: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe("MarketPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(getPostings).mockReset();
    vi.mocked(getSkillStats).mockReset();
    vi.mocked(getSkillGraph).mockReset();
    vi.mocked(getPostings).mockResolvedValue({ total: 0, items: [] });
    vi.mocked(getSkillStats).mockResolvedValue({ total: 0, items: [] });
    vi.mocked(getSkillGraph).mockResolvedValue({
      seed: null,
      nodes: [],
      edges: [],
      evidence: [],
      meta: { limit: 60, min_confidence: 0.8 },
    });
  });

  it("loads both market resources with selected career and category filters", async () => {
    render(
      await MarketPage({
        searchParams: Promise.resolve({
          career_type: "experienced",
          category: "infra",
        }),
      }),
    );

    expect(getPostings).toHaveBeenCalledWith({
      career_type: "experienced",
      category: "infra",
      limit: 100,
    });
    expect(getSkillStats).toHaveBeenCalledWith({
      career_type: "experienced",
      category: "infra",
      limit: 100,
    });
    expect(getSkillGraph).toHaveBeenCalledWith({
      career_type: "experienced",
      include_evidence: true,
      limit: 60,
    });
    expect(
      screen.getByRole("heading", {
        name: "분야별 채용 현황과 기술 수요",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "인프라" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByText(/커리어핏이 분석한 채용공고 범위/),
    ).toBeInTheDocument();
  });

  it("normalizes an unsupported career filter to the whole market", async () => {
    render(
      await MarketPage({
        searchParams: Promise.resolve({
          career_type: "unsupported",
          category: "unsupported",
        }),
      }),
    );

    expect(getPostings).toHaveBeenCalledWith({ limit: 100 });
    expect(getSkillStats).toHaveBeenCalledWith({ limit: 100 });
    expect(getSkillGraph).toHaveBeenCalledWith({
      include_evidence: true,
      limit: 60,
    });
    expect(
      within(
        screen.getByRole("navigation", { name: "기술 분류" }),
      ).getByRole("link", { name: "전체" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
