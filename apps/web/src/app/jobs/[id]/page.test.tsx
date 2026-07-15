import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPosting } from "@/lib/api";

import JobDetail, { generateMetadata } from "./page";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, getPosting: vi.fn() };
});

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not found");
  }),
}));

const job = {
  id: "job-1",
  title: "Backend Engineer",
  company_name: "토스",
  company_slug: "toss",
  career_type: "experienced",
  employment_type: "FULL_TIME",
  career_min: 3,
  career_max: 7,
  location: "서울",
  status: "open",
  source_url: "https://careers.toss.im/job-1",
  last_verified_at: "2026-07-12T15:00:00.000Z",
  description_html: "<p>서버 개발</p>",
  description_text:
    "제품 소개입니다. ### 주요 업무 * 안정적인 서버를 개발합니다. * 장애 원인을 분석합니다.",
  opens_at: "2026-07-01T00:00:00.000Z",
  closes_at: "2026-07-31T14:59:59.000Z",
  skills: ["Go"],
  skill_details: [
    {
      skill: "Go",
      category: "language",
      requirement_type: "required" as const,
      evidence_text: "Go 기반 서버 개발 경험",
      confidence: 0.96,
      match_reason: "strict_alias_with_context",
    },
  ],
};

describe("JobDetail", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    vi.mocked(getPosting).mockResolvedValue(job);
  });

  it("builds concise dynamic metadata with a canonical detail URL", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: "job-1" }) });

    expect(metadata.title).toBe("Backend Engineer - 토스");
    expect(metadata.description).toContain("서울");
    expect(metadata.description).toContain("경력");
    expect(metadata.alternates?.canonical).toBe("/jobs/job-1");
    expect(metadata.description).not.toContain(job.description_text);
  });

  it("renders JSON-LD and trust actions before the long description", async () => {
    const { container } = render(
      await JobDetail({ params: Promise.resolve({ id: "job-1" }) }),
    );

    expect(screen.getByRole("link", { name: "공식 공고 열기" })).toHaveAttribute(
      "href",
      job.source_url,
    );
    expect(screen.getByText(/마지막 확인/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "요구 기술 근거" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "분석 방법" })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(screen.getByRole("link", { name: "정보 정정 요청" })).toHaveAttribute(
      "href",
      "/corrections",
    );
    expect(screen.getByTitle("토스")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "토스 기업 채용 현황" }),
    ).toHaveAttribute("href", "/companies/toss");
    expect(
      screen.getByRole("heading", { level: 2, name: "채용 조건" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "요구 기술 근거" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go 스킬맵" })).toHaveAttribute(
      "href",
      "/skill-map?skill=Go",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "공고 원문" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "주요 업무" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "지원 준비" }),
    ).toBeInTheDocument();

    const jsonLdNode = container.querySelector('script[type="application/ld+json"]');
    const jsonLd = JSON.parse(jsonLdNode?.textContent ?? "{}");
    expect(jsonLd).toMatchObject({
      "@type": "JobPosting",
      title: "Backend Engineer",
      url: job.source_url,
      datePosted: job.opens_at,
      validThrough: job.closes_at,
      hiringOrganization: { name: "토스" },
    });
    expect(JSON.stringify(jsonLd.jobLocation)).toContain("서울");

    const trust = screen.getByRole("region", { name: "공고 신뢰 정보" });
    const skills = screen.getByRole("region", { name: "요구 기술 근거" });
    const description = screen.getByRole("region", { name: "공고 원문" });
    expect(
      skills.compareDocumentPosition(trust) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      trust.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the company name as text when a compatible response has no slug", async () => {
    vi.mocked(getPosting).mockResolvedValue({
      ...job,
      company_slug: undefined,
    });

    render(await JobDetail({ params: Promise.resolve({ id: "job-1" }) }));

    expect(screen.getByText("토스")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "토스 기업 채용 현황" }),
    ).not.toBeInTheDocument();
  });

  it("states when the API provides no body or confirmed skill evidence", async () => {
    vi.mocked(getPosting).mockResolvedValue({
      ...job,
      description_html: "<script>alert('never render')</script>",
      description_text: "",
      skills: [],
      skill_details: [],
    });

    render(await JobDetail({ params: Promise.resolve({ id: "job-1" }) }));

    expect(
      screen.getByText("확정 임계값을 통과한 기술 요구사항이 없습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "API가 제공한 공고 본문 텍스트가 없습니다. 공식 원문을 확인해 주세요.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("never render")).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: /공식/ }).length,
    ).toBeGreaterThan(0);
  });

  it("rejects a non-http source URL before rendering application links", async () => {
    vi.mocked(getPosting).mockResolvedValue({
      ...job,
      source_url: "javascript:alert('unsafe')",
    });

    await expect(
      JobDetail({ params: Promise.resolve({ id: "job-1" }) }),
    ).rejects.toThrow("Invalid source_url");
  });
});
