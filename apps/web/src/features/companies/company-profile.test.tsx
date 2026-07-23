import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PostingListResponse } from "@/lib/types";

import { CompanyProfile } from "./company-profile";

const postings: PostingListResponse = {
  total: 2,
  items: [
    {
      id: "job-platform",
      title: "플랫폼 엔지니어",
      company_name: "NAVER",
      company_slug: "naver",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://recruit.navercorp.com/job-platform",
      last_verified_at: "2026-07-14T03:00:00Z",
      closes_at: "2026-07-31T14:59:59Z",
      required_skills: ["Go", "Docker"],
      preferred_skills: ["Kubernetes"],
      unspecified_skills: [],
    },
    {
      id: "job-backend",
      title: "백엔드 엔지니어",
      company_name: "NAVER",
      company_slug: "naver",
      career_type: "mixed",
      employment_type: "FULL_TIME_WORKER",
      career_min: null,
      career_max: null,
      location: "성남",
      status: "open",
      source_url: "https://recruit.navercorp.com/job-backend",
      last_verified_at: "2026-07-13T03:00:00Z",
      required_skills: ["Kubernetes"],
      preferred_skills: [],
      unspecified_skills: ["Docker"],
    },
  ],
};

describe("CompanyProfile", () => {
  afterEach(() => cleanup());

  it("renders only current official posting evidence for the company", () => {
    render(
      <CompanyProfile companySlug="naver" postings={postings} />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "NAVER" }),
    ).toBeInTheDocument();
    expect(screen.getByTitle("네이버 로고")).toBeInTheDocument();
    expect(screen.getByText("현재 공개 공고 2건")).toBeInTheDocument();
    expect(screen.getByText("확정 기술 3개")).toBeInTheDocument();
    expect(screen.getByText("근무 지역 2곳")).toBeInTheDocument();
    expect(screen.getByText("최근 확인")).toBeInTheDocument();
    expect(screen.getAllByText("7월 14일 확인")).toHaveLength(2);

    const jobs = screen.getByRole("region", { name: "현재 공개 공고" });
    expect(
      within(jobs).getByRole("link", { name: "플랫폼 엔지니어" }),
    ).toHaveAttribute("href", "/jobs/job-platform");
    expect(
      within(jobs).getByRole("link", { name: "백엔드 엔지니어" }),
    ).toHaveAttribute("href", "/jobs/job-backend");
    expect(within(jobs).getByText("경력 3~7년")).toBeInTheDocument();
    expect(within(jobs).getByText("7월 31일 마감")).toBeInTheDocument();
    expect(within(jobs).getAllByRole("link", { name: "공식 원문" })).toHaveLength(2);

    const evidence = screen.getByRole("complementary", {
      name: "기업 채용 근거",
    });
    expect(within(evidence).getByRole("link", { name: "Docker 스킬맵" })).toHaveAttribute(
      "href",
      "/skill-map?skill=Docker",
    );
    expect(within(evidence).getAllByText("2개 공고")).toHaveLength(2);
    expect(within(evidence).getByText("필수 1 · 우대 1")).toBeInTheDocument();
    expect(within(evidence).getByText("정규직").closest("li")).toHaveTextContent("2");
    expect(within(evidence).getByText("서울").closest("li")).toHaveTextContent("1");
    expect(screen.getByRole("link", { name: "분석 방법" })).toHaveAttribute(
      "href",
      "/methodology",
    );
    expect(screen.getByRole("link", { name: "데이터 정책" })).toHaveAttribute(
      "href",
      "/data-policy",
    );
    expect(screen.queryByText(/직원 수|평균 연봉|성장률|기업 평점/)).not.toBeInTheDocument();
  });

  it("distinguishes an empty API result from a request failure", () => {
    const { rerender } = render(
      <CompanyProfile
        companySlug="verified-company"
        postings={{ items: [], total: 0 }}
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "현재 확인되는 공개 공고가 없습니다.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("기업 공고 데이터를 불러오지 못했습니다."),
    ).not.toBeInTheDocument();

    rerender(
      <CompanyProfile companySlug="verified-company" error postings={null} />,
    );

    expect(
      screen.getByRole("heading", {
        name: "기업 공고 데이터를 불러오지 못했습니다.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("현재 확인되는 공개 공고가 없습니다."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
      "href",
      "/companies/verified-company",
    );
  });
});
