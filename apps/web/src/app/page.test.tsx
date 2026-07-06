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
        name: /당신의 기술 스택은 어디로 이어질까/,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "스킬 그래프 열기" }),
    ).toHaveAttribute("href", "/skills/graph");
    expect(
      screen.getByText(/공고 속 기술 조합을 그래프로 해석해/),
    ).toBeInTheDocument();
  });
});
