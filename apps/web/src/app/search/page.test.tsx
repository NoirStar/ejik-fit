import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings, getSkillStats } from "@/lib/api";
import type { PostingListResponse, SkillStatsResponse } from "@/lib/types";

import SearchPage, { generateMetadata } from "./page";

vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
  getSkillStats: vi.fn(),
}));

const postings: PostingListResponse = {
  total: 1,
  items: [
    {
      id: "job-python",
      title: "Python Backend Engineer",
      company_name: "NAVER",
      company_slug: "naver",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://recruit.navercorp.com/job-python",
      last_verified_at: "2026-07-14T03:00:00.000Z",
      required_skills: ["Python"],
      preferred_skills: ["Docker"],
      unspecified_skills: [],
    },
  ],
};

const skillStats: SkillStatsResponse = {
  total: 2,
  items: [
    {
      skill: "Python",
      category: "language",
      count: 18,
      required_count: 12,
      preferred_count: 4,
      unspecified_count: 2,
    },
    {
      skill: "Kubernetes",
      category: "infra",
      count: 7,
      required_count: 3,
      preferred_count: 4,
      unspecified_count: 0,
    },
  ],
};

describe("SearchPage", () => {
  beforeEach(() => {
    vi.mocked(getPostings).mockReset();
    vi.mocked(getSkillStats).mockReset();
  });

  afterEach(() => cleanup());

  it("does not call actual-data APIs before a query is provided", async () => {
    render(await SearchPage());

    expect(getPostings).not.toHaveBeenCalled();
    expect(getSkillStats).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "무엇을 찾고 있나요?" }),
    ).toBeInTheDocument();
  });

  it("loads normalized actual posting and skill evidence in parallel", async () => {
    vi.mocked(getPostings).mockResolvedValue(postings);
    vi.mocked(getSkillStats).mockResolvedValue(skillStats);

    render(
      await SearchPage({
        searchParams: Promise.resolve({ q: "  Python  ", scope: "companies" }),
      }),
    );

    expect(getPostings).toHaveBeenCalledWith({ q: "Python", limit: 100 });
    expect(getSkillStats).toHaveBeenCalledWith({ limit: 100 });
    expect(
      screen.getByRole("link", { name: "NAVER 기업 채용 현황" }),
    ).toHaveAttribute("href", "/companies/naver");
    expect(
      screen.queryByRole("link", { name: "Python 스킬맵 보기" }),
    ).not.toBeInTheDocument();
  });

  it("keeps skill and mock results when posting search fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getPostings).mockRejectedValue(
      new Error("API request failed: http://internal-api/api/postings (503)"),
    );
    vi.mocked(getSkillStats).mockResolvedValue(skillStats);

    render(
      await SearchPage({
        searchParams: Promise.resolve({ q: "Kubernetes" }),
      }),
    );

    expect(
      screen.getByText("일부 실제 검색 결과를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("공고 검색 결과를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Kubernetes 스킬맵 보기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Kubernetes 실무 경험은 어디서부터 쌓는 게 좋을까요?",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/internal-api|503/)).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("rejects an unsafe posting response before rendering external links", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getPostings).mockResolvedValue({
      ...postings,
      items: [
        {
          ...postings.items[0],
          source_url: "javascript:alert('unsafe')",
        },
      ],
    });
    vi.mocked(getSkillStats).mockResolvedValue(skillStats);

    render(
      await SearchPage({
        searchParams: Promise.resolve({ q: "Python" }),
      }),
    );

    expect(
      screen.getByText("공고 검색 결과를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "공식 원문" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Python 스킬맵 보기" })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("rejects malformed skill counts without hiding valid posting results", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    vi.mocked(getPostings).mockResolvedValue(postings);
    vi.mocked(getSkillStats).mockResolvedValue({
      total: 1,
      items: [
        {
          skill: "Python",
          category: "language",
          count: -1,
          required_count: -2,
        },
      ],
    });

    render(
      await SearchPage({
        searchParams: Promise.resolve({ q: "Python" }),
      }),
    );

    expect(
      screen.getByText("기술 통계 표본을 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Python Backend Engineer" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Python 스킬맵 보기" }),
    ).not.toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("creates query-aware noindex metadata with a stable canonical route", async () => {
    await expect(
      generateMetadata({
        searchParams: Promise.resolve({ q: "  Python  " }),
      }),
    ).resolves.toMatchObject({
      title: "“Python” 검색",
      alternates: { canonical: "/search" },
      robots: { index: false, follow: true },
    });

    await expect(generateMetadata({})).resolves.toMatchObject({
      title: "통합 검색",
      robots: { index: false, follow: true },
    });
  });
});
