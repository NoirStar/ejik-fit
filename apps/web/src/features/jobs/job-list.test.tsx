import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PostingListResponse } from "@/lib/types";

import { JobList } from "./job-list";

const postings: PostingListResponse = {
  total: 1,
  items: [
    {
      id: "job-1",
      title: "Backend Engineer",
      company_name: "토스",
      career_type: "experienced",
      employment_type: "FULL_TIME",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://careers.toss.im/job-1",
      last_verified_at: "2026-07-12T15:00:00.000Z",
    },
  ],
};

describe("JobList", () => {
  afterEach(() => cleanup());

  it("renders URL-backed filters, result count, and trusted links", () => {
    render(
      <JobList
        filters={{ query: "backend", careerType: "experienced" }}
        postings={postings}
      />,
    );

    expect(screen.getByLabelText("공고 검색")).toHaveValue("backend");
    expect(screen.getByLabelText("경력 조건")).toHaveValue("experienced");
    expect(screen.getByText("1개 공고")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Backend Engineer" })).toHaveAttribute(
      "href",
      "/jobs/job-1",
    );
    expect(screen.getByRole("link", { name: "공식 원문" })).toHaveAttribute(
      "href",
      "https://careers.toss.im/job-1",
    );
    expect(screen.getByRole("link", { name: "공식 원문" })).toHaveAttribute(
      "target",
      "_blank",
    );
    expect(screen.getByRole("link", { name: "필터 초기화" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(screen.queryByText("기간")).not.toBeInTheDocument();
    expect(screen.queryByText("마감 임박")).not.toBeInTheDocument();
  });

  it("distinguishes an empty result from an API error", () => {
    const { rerender } = render(
      <JobList
        filters={{ query: "rust", careerType: "" }}
        postings={{ items: [], total: 0 }}
      />,
    );

    expect(screen.getByText("조건에 맞는 공식 공고가 없습니다.")).toBeInTheDocument();
    expect(screen.queryByText("공고 데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();

    rerender(
      <JobList
        error="공고 데이터를 불러오지 못했습니다."
        filters={{ query: "rust", careerType: "" }}
        postings={null}
      />,
    );

    expect(screen.getByText("공고 데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.queryByText("조건에 맞는 공식 공고가 없습니다.")).not.toBeInTheDocument();
  });
});
