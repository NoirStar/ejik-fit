import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Home from "./page";

import { getPostings, getSkillStats } from "@/lib/api";


vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
  getSkillStats: vi.fn(),
}));


describe("Home", () => {
  it("introduces ejik as a graph-first career intelligence product", async () => {
    vi.mocked(getPostings).mockResolvedValue({
      items: [],
      total: 0,
    });
    vi.mocked(getSkillStats).mockResolvedValue({
      items: [
        {
          skill: "Python",
          category: "language",
          count: 42,
          required_count: 28,
          preferred_count: 10,
          unspecified_count: 4,
        },
      ],
      total: 1,
    });

    render(await Home({ searchParams: Promise.resolve({}) }));

    expect(
      screen.getByRole("heading", {
        name: /내 기술이 시장에서 어디로 이어지는지/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "대시보드 열기" }),
    ).toHaveAttribute("href", "/skills/graph");
    expect(
      screen.getByText(/공개 채용공고에서 반복되는 기술 조합을 분석해/),
    ).toBeInTheDocument();
  });
});
