import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings } from "@/lib/api";
import { EMPTY_CAREER_PROFILE, writeCareerProfile } from "@/lib/career-profile";

import Home, { metadata } from "./page";

vi.mock("@/lib/api", () => ({ getPostings: vi.fn() }));

const response = {
  total: 1,
  items: [
    {
      id: "job-1",
      title: "Backend Engineer",
      company_name: "토스",
      company_slug: "toss",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: 8,
      location: "서울",
      status: "open",
      source_url: "https://careers.example.com/job-1",
      last_verified_at: "2026-07-30T00:00:00Z",
      description_excerpt: "결제 API를 개발하고 백엔드 서비스 운영을 담당합니다.",
      required_skills: ["Java", "Spring"],
      preferred_skills: ["Kafka"],
      unspecified_skills: [],
    },
  ],
};

describe("Home", () => {
  beforeEach(() => {
    vi.mocked(getPostings).mockResolvedValue(response);
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("uses the full CareerFit browser title in the root route", () => {
    expect(metadata.title).toEqual({
      absolute: "커리어핏 | 경력과 채용공고를 연결하는 커리어 분석",
    });
  });

  it("shows a short product onboarding state before a profile exists", async () => {
    render(await Home());

    expect(screen.getByRole("heading", {
      name: "내 경험에서 이어갈 커리어 방향을 확인하세요",
    })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 커리어 분석하기" }))
      .toHaveAttribute("href", "/career");
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText(/01|02|03/)).not.toBeInTheDocument();
    expect(getPostings).toHaveBeenCalledWith({ limit: 60 });
  });

  it("shows the unified career dashboard immediately for a profiled user", async () => {
    writeCareerProfile({
      ...EMPTY_CAREER_PROFILE,
      currentRole: "백엔드 개발자",
      experienceYears: 5,
      responsibilities: "결제 API 개발과 백엔드 서비스 운영",
      currentDomain: "backend",
      workTypes: ["development", "operations"],
    });

    render(
      await Home({
        searchParams: Promise.resolve({ owned_skills: ["Java", "Kafka"] }),
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", {
        name: "백엔드 개발자 경험에서 이어갈 방향",
      })).toBeInTheDocument();
    });
    expect(screen.getByText("먼저 확인할 커리어 방향")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /대표 공고: Backend Engineer/ }))
      .toHaveAttribute("href", "/jobs/job-1");
    expect(screen.queryByRole("tab", { name: "둘러보기" }))
      .not.toBeInTheDocument();
    expect(getPostings).toHaveBeenCalledTimes(1);
    expect(getPostings).toHaveBeenCalledWith({ limit: 60 });
  });

  it("keeps the saved profile and a retry action when postings fail", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getPostings).mockRejectedValue(new Error("private API detail"));
    writeCareerProfile({
      ...EMPTY_CAREER_PROFILE,
      currentRole: "보안 엔지니어",
      responsibilities: "침해 탐지와 보안 사고 대응",
    });

    render(await Home());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "채용공고를 불러오지 못했습니다",
    );
    expect(screen.getByText(/브라우저에 저장된 프로필은 유지됩니다/))
      .toBeInTheDocument();
    expect(screen.queryByText("private API detail")).not.toBeInTheDocument();
    log.mockRestore();
  });

  it("does not mix the community composer into home", async () => {
    render(await Home({ searchParams: Promise.resolve({ compose: "1" }) }));

    expect(screen.queryByRole("dialog", { name: "커뮤니티 글쓰기" }))
      .not.toBeInTheDocument();
  });
});
