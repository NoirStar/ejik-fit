import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPostings } from "@/lib/api";

import CompanyPage, { generateMetadata } from "./page";

vi.mock("@/lib/api", () => ({
  getPostings: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));

const postings = {
  total: 1,
  items: [
    {
      id: "job-1",
      title: "백엔드 엔지니어",
      company_name: "검증 기업",
      company_slug: "verified-company",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://careers.example.com/job-1",
      last_verified_at: "2026-07-14T03:00:00Z",
      required_skills: ["Go"],
      preferred_skills: [],
      unspecified_skills: [],
    },
  ],
};

describe("CompanyPage", () => {
  beforeEach(() => {
    vi.mocked(getPostings).mockReset();
    vi.mocked(getPostings).mockResolvedValue(postings);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("loads the company slug through the official posting API", async () => {
    render(
      await CompanyPage({
        params: Promise.resolve({ companyId: "verified-company" }),
      }),
    );

    expect(getPostings).toHaveBeenCalledWith({
      company: "verified-company",
      limit: 100,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "검증 기업" }),
    ).toBeInTheDocument();
  });

  it("preserves the API total when the company list is capped", async () => {
    vi.mocked(getPostings).mockResolvedValue({
      ...postings,
      total: 145,
    });

    render(
      await CompanyPage({
        params: Promise.resolve({ companyId: "verified-company" }),
      }),
    );

    expect(screen.getByText("현재 공개 공고 145건")).toBeInTheDocument();
    expect(screen.getByText("1 / 145건 표시")).toBeInTheDocument();
    expect(screen.getByText(/최근 1개 공고를 기준으로 집계/)).toBeInTheDocument();
  });

  it("renders an honest error state instead of claiming zero jobs", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(getPostings).mockRejectedValue(new Error("offline"));

    render(
      await CompanyPage({
        params: Promise.resolve({ companyId: "verified-company" }),
      }),
    );

    expect(
      screen.getByRole("heading", {
        name: "기업 공고 데이터를 불러오지 못했습니다.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("현재 확인되는 공개 공고가 없습니다."),
    ).not.toBeInTheDocument();
  });

  it("rejects malformed company route values before calling the API", async () => {
    await expect(
      CompanyPage({
        params: Promise.resolve({ companyId: "../unsafe" }),
      }),
    ).rejects.toThrow("not found");
    expect(getPostings).not.toHaveBeenCalled();
  });

  it("builds factual company metadata and a canonical URL", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ companyId: "verified-company" }),
    });

    expect(metadata.title).toBe("검증 기업 채용 현황");
    expect(metadata.description).toContain("현재 확인된 공개 공고 1건");
    expect(metadata.alternates?.canonical).toBe(
      "/companies/verified-company",
    );
  });
});
