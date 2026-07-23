import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { JobCard } from "./job-card";


const job = {
  id: "1",
  title: "신입 백엔드 개발자",
  company_name: "테스트 기업",
  career_type: "new_comer",
  employment_type: "FULL_TIME",
  career_min: null,
  career_max: null,
  location: "서울",
  status: "open",
  source_url: "https://example.com/o/1",
  last_verified_at: "2026-07-03T00:00:00Z",
};


describe("JobCard", () => {
  it("shows company, career and verification metadata", () => {
    render(<JobCard job={job} />);

    expect(screen.getByText("테스트 기업")).toBeInTheDocument();
    expect(screen.getByText("신입")).toBeInTheDocument();
    expect(screen.getByText("정규직")).toBeInTheDocument();
    expect(screen.getByText(/최근 확인/)).toBeInTheDocument();
    const internalDetailLink = screen.getByRole("link", {
      name: "신입 백엔드 개발자",
    });
    expect(internalDetailLink).toHaveAttribute("href", "/jobs/1");
    expect(internalDetailLink).not.toHaveAttribute("target");
    const companyPageLink = screen.getByRole("link", {
      name: "기업 채용페이지 보기",
    });
    expect(companyPageLink).toHaveAttribute("href", job.source_url);
    expect(companyPageLink).toHaveAttribute("target", "_blank");
    expect(companyPageLink).toHaveAttribute("rel", "noreferrer");
  });
});
