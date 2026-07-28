import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPosting } from "@/lib/api";

import JobDetailError from "./error";
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
    "이 팀은 대규모 트래픽을 안정적으로 처리하는 서버 플랫폼을 개발하고 운영합니다. 사용자 경험과 서비스 신뢰도를 높이기 위해 장애 원인을 분석하고 배포 과정을 자동화합니다. 여러 직군과 협업해 장기적인 기술 방향을 정하고 품질 기준을 개선합니다. ### 주요 업무 * 안정적인 서버를 개발합니다. * 장애 원인을 분석합니다.",
  description_images: [
    {
      url: "https://careers.toss.im/job-1/detail.png",
      alt: "채용 공고 상세 내용 이미지 1",
    },
  ],
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

    const backLink = screen.getByRole("link", {
      name: "채용공고로 돌아가기",
    });
    expect(backLink).toHaveAttribute("href", "/jobs");
    expect(backLink).not.toHaveAttribute("target");
    const trust = screen.getByRole("region", { name: "공고 신뢰 정보" });
    const companyPageLink = within(trust).getByRole("link", {
      name: "기업 채용페이지 보기",
    });
    expect(companyPageLink).toHaveAttribute("href", job.source_url);
    expect(companyPageLink).toHaveAttribute("target", "_blank");
    expect(companyPageLink).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText(/최근 확인/)).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "기술 요건" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "분석 방법" })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(screen.getByRole("link", { name: "정보 정정 요청" })).toHaveAttribute(
      "href",
      "/corrections",
    );
    expect(screen.getByTitle("토스 커뮤니티 로고")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "토스 기업 채용 현황" }),
    ).toHaveAttribute("href", "/companies/toss");
    expect(
      screen.getByRole("heading", { level: 2, name: "채용 조건" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "기술 요건" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go 스킬맵" })).toHaveAttribute(
      "href",
      "/skill-map?skill=Go",
    );
    expect(
      screen.getByRole("heading", { level: 2, name: "공고 원문" }),
    ).toBeInTheDocument();
    expect(screen.getByText("제공된 공고 원문")).toBeInTheDocument();
    const description = screen.getByRole("region", { name: "공고 원문" });
    const continueLink = within(description).getByRole("link", {
      name: "기업 채용페이지 보기",
    });
    expect(continueLink).toHaveAttribute("href", job.source_url);
    expect(continueLink).toHaveAttribute("target", "_blank");
    expect(continueLink).toHaveAttribute("rel", "noreferrer");
    expect(
      screen.getByRole("heading", { level: 3, name: "주요 업무" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "채용 공고 상세 내용 이미지 1" }),
    ).toHaveAttribute("loading", "lazy");
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

    const skills = screen.getByRole("region", { name: "기술 요건" });
    expect(
      skills.compareDocumentPosition(trust) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      trust.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText(/API/)).not.toBeInTheDocument();
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

  it("marks delayed postings as unverified and omits active JobPosting JSON-LD", async () => {
    vi.mocked(getPosting).mockResolvedValue({
      ...job,
      status: "delayed",
    });

    const { container } = render(
      await JobDetail({ params: Promise.resolve({ id: "job-1" }) }),
    );

    expect(screen.getByText("확인 지연")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "공고 검증 지연 안내" }),
    ).toHaveTextContent("현재 모집 여부를 공식 원문에서 다시 확인해 주세요.");
    expect(
      container.querySelector('script[type="application/ld+json"]'),
    ).not.toBeInTheDocument();
  });

  it("directs sparse posting metadata to the official job page", async () => {
    vi.mocked(getPosting).mockResolvedValue({
      ...job,
      description_html: "<script>alert('never render')</script>",
      description_text: "Tech Frontend NAVER WEBTOON 경력 정규직",
      description_images: [],
      skills: [],
      skill_details: [],
    });

    render(await JobDetail({ params: Promise.resolve({ id: "job-1" }) }));

    expect(
      screen.getByText("확인된 기술 요건이 없습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "상세 내용 수집을 점검 중입니다. 지원 요건은 공식 공고에서 확인해 주세요.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "공고 상세" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { level: 2, name: "공고 원문" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("제공된 공고 원문")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Tech Frontend NAVER WEBTOON 경력 정규직"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/API/)).not.toBeInTheDocument();
    expect(screen.queryByText("never render")).not.toBeInTheDocument();
    const detail = screen.getByRole("region", { name: "공고 상세" });
    expect(
      within(detail).getByRole("link", { name: "기업 채용페이지 보기" }),
    ).toHaveAttribute("href", job.source_url);
  });

  it("keeps an official image-only posting in the source-detail state", async () => {
    vi.mocked(getPosting).mockResolvedValue({
      ...job,
      description_html: '<img src="/job-1/detail.png">',
      description_text: "",
      description_images: [
        {
          url: "https://careers.toss.im/job-1/detail.png",
          alt: "채용 공고 상세 내용 이미지 1",
        },
      ],
    });

    render(await JobDetail({ params: Promise.resolve({ id: "job-1" }) }));

    expect(
      screen.getByRole("heading", { level: 2, name: "공고 원문" }),
    ).toBeInTheDocument();
    expect(screen.getByText("제공된 공고 원문")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "채용 공고 상세 내용 이미지 1" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/제공된 공고 원문이 없습니다/),
    ).not.toBeInTheDocument();
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

  it("returns from a detail error to the job list with the shared job name", () => {
    render(<JobDetailError reset={vi.fn()} />);

    expect(
      screen.getByText("잠시 후 다시 시도하거나 채용공고로 돌아가 주세요."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "채용공고" })).toHaveAttribute(
      "href",
      "/jobs",
    );
  });
});
