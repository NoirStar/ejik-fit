import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings, getSkillStats } from "@/lib/api";

import MarketPage from "./page";

vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
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
      limit: 100,
    });
    expect(
      screen.getByRole("heading", {
        name: "지금 채용 시장의 기술 흐름",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "인프라" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByText(/기업 공식 채용 페이지 확인 범위/),
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
    expect(
      within(
        screen.getByRole("navigation", { name: "포함 기술 분야" }),
      ).getByRole("link", { name: "전체" }),
    ).toHaveAttribute("aria-current", "page");
  });
});
