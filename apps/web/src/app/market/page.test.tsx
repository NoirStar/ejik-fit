import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings, getSkillStats } from "@/lib/api";

import MarketPage from "./page";

vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
  getSkillStats: vi.fn(),
}));

describe("MarketPage", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(getPostings).mockReset();
    vi.mocked(getSkillStats).mockReset();
    vi.mocked(getPostings).mockResolvedValue({ total: 0, items: [] });
    vi.mocked(getSkillStats).mockResolvedValue({ total: 0, items: [] });
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
      limit: 30,
    });
    expect(
      screen.getByRole("heading", { name: "채용 시장", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "인프라" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText(/인프라 기술이 확인된 공개 공고/)).toBeInTheDocument();
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
    expect(getSkillStats).toHaveBeenCalledWith({ limit: 30 });
    expect(screen.getByRole("link", { name: "전체 기술 분야" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
