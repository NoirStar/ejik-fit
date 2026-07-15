import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings } from "@/lib/api";
import type { PostingListResponse } from "@/lib/types";

import JobsPage from "./page";

vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
}));

const response: PostingListResponse = {
  total: 1,
  items: [
    {
      id: "job-1",
      title: "Python Engineer",
      company_name: "검증 기업",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: null,
      location: "서울",
      status: "open",
      source_url: "https://careers.example.com/job-1",
      last_verified_at: "2026-07-14T03:00:00Z",
      opens_at: null,
      closes_at: null,
      required_skills: ["Python"],
      preferred_skills: [],
      unspecified_skills: [],
    },
  ],
};

describe("JobsPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.mocked(getPostings).mockReset();
  });

  afterEach(() => cleanup());

  it("loads sanitized URL filters and actual posting evidence", async () => {
    vi.mocked(getPostings).mockResolvedValue(response);

    render(
      await JobsPage({
        searchParams: Promise.resolve({
          q: " Python ",
          career_type: "experienced",
          category: "infra",
        }),
      }),
    );

    expect(getPostings).toHaveBeenCalledWith({
      q: "Python",
      career_type: "experienced",
      category: "infra",
      limit: 100,
    });
    expect(screen.getByRole("link", { name: "Python Engineer" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Python 스킬맵" })).toBeInTheDocument();
    expect(screen.getByLabelText("기술 분야")).toHaveValue("infra");
  });

  it("keeps filters usable without leaking request errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getPostings).mockRejectedValue(
      new Error("API request failed: http://internal-api/api/postings (503)"),
    );

    render(
      await JobsPage({
        searchParams: Promise.resolve({ q: "Rust", category: "security" }),
      }),
    );

    expect(screen.getByText("공고 데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByLabelText("공고 검색")).toHaveValue("Rust");
    expect(screen.getByText("공고 집계 불가")).toBeInTheDocument();
    expect(screen.queryByText("현재 결과 0건")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
      "href",
      "/jobs?q=Rust&category=security",
    );
    expect(screen.queryByText(/internal-api|503/)).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("drops an unsupported category instead of requesting an empty market", async () => {
    vi.mocked(getPostings).mockResolvedValue(response);

    render(
      await JobsPage({
        searchParams: Promise.resolve({ category: "unsupported" }),
      }),
    );

    expect(getPostings).toHaveBeenCalledWith({ limit: 100 });
    expect(screen.getByLabelText("기술 분야")).toHaveValue("");
  });

  it("rejects a malformed successful API response", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getPostings).mockResolvedValue({
      items: null,
      total: 1,
    } as unknown as PostingListResponse);

    render(await JobsPage());

    expect(screen.getByText("공고 데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.queryByText("조건에 맞는 공식 공고가 없습니다.")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("rejects unsafe source links from an otherwise valid response", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getPostings).mockResolvedValue({
      ...response,
      items: [
        {
          ...response.items[0],
          source_url: "javascript:alert('unsafe')",
        },
      ],
    });

    render(await JobsPage());

    expect(screen.getByText("공고 데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "공식 원문" })).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
