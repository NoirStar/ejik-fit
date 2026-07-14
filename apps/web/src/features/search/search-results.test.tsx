import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { SearchSnapshot } from "./model";
import { SearchResults } from "./search-results";

function snapshot(
  overrides: Partial<SearchSnapshot> = {},
): SearchSnapshot {
  return {
    query: "Python",
    scope: "all",
    dataStatus: "ready",
    companies: [
      {
        slug: "naver",
        name: "NAVER",
        href: "/companies/naver",
        postingCount: 2,
        latestVerifiedAt: "2026-07-14T03:00:00.000Z",
        skillNames: ["Python", "Docker"],
        sourceUrl: "https://recruit.navercorp.com/job-python",
      },
    ],
    jobs: [
      {
        id: "job-python",
        title: "Python Backend Engineer",
        companyName: "NAVER",
        companyHref: "/companies/naver",
        href: "/jobs/job-python",
        sourceUrl: "https://recruit.navercorp.com/job-python",
        careerType: "experienced",
        employmentType: "FULL_TIME_WORKER",
        location: "서울",
        lastVerifiedAt: "2026-07-14T03:00:00.000Z",
        requiredSkills: ["Python"],
        preferredSkills: ["Docker"],
        unspecifiedSkills: [],
      },
    ],
    skills: [
      {
        name: "Python",
        category: "language",
        postingCount: 18,
        requiredCount: 12,
        preferredCount: 4,
        unspecifiedCount: 2,
        skillHref: "/skill-map?skill=Python",
        jobsHref: "/jobs?q=Python",
      },
    ],
    community: [
      {
        id: "python-career",
        category: "커리어 질문",
        title: "Python에서 Go로 옮긴 경험이 궁금해요",
        summary: "언어 전환을 준비하는 예시 질문입니다.",
        tags: ["Python", "커리어 전환"],
        href: "/posts/python-career",
        authorName: "코드산책",
        authorHeadline: "백엔드 개발자 · 4년차",
        createdLabel: "1시간 전",
        source: "mock",
      },
    ],
    counts: { companies: 1, jobs: 1, skills: 1, community: 1 },
    errors: [],
    hasAnyResults: true,
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("SearchResults", () => {
  it("renders a useful no-query state without invented result numbers", () => {
    render(
      <SearchResults
        snapshot={
          snapshot({
            query: "",
            dataStatus: "idle",
            companies: [],
            jobs: [],
            skills: [],
            community: [],
            counts: {
              companies: null,
              jobs: null,
              skills: null,
              community: 0,
            },
            hasAnyResults: false,
          })
        }
      />,
    );

    expect(
      screen.getByRole("heading", { name: "무엇을 찾고 있나요?" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "검색어" })).toHaveValue("");
    expect(screen.getByText("검색어를 입력하면 결과를 나눠 보여드려요.")).toBeInTheDocument();
    expect(screen.queryByText(/전체 결과 \d+건/)).not.toBeInTheDocument();
  });

  it("separates actual company, job, skill evidence from mock community results", () => {
    render(<SearchResults snapshot={snapshot()} />);

    expect(
      screen.getByRole("heading", { name: "“Python” 검색 결과" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "검색어" })).toHaveValue(
      "Python",
    );
    expect(screen.getByRole("link", { name: /기업.*1/ })).toHaveAttribute(
      "href",
      "/search?q=Python&scope=companies",
    );

    const company = screen
      .getByRole("link", { name: "NAVER 기업 채용 현황" })
      .closest("article")!;
    expect(within(company).getByText("현재 검색 응답 공고 2건")).toBeInTheDocument();
    expect(within(company).getByRole("link", { name: "Python 스킬맵" })).toHaveAttribute(
      "href",
      "/skill-map?skill=Python",
    );

    const job = screen
      .getByRole("link", { name: "Python Backend Engineer" })
      .closest("article")!;
    expect(within(job).getByText("공식 공고")).toBeInTheDocument();
    expect(within(job).getByRole("link", { name: "공식 원문" })).toHaveAttribute(
      "href",
      "https://recruit.navercorp.com/job-python",
    );

    const skill = screen
      .getByRole("link", { name: "Python 스킬맵 보기" })
      .closest("article")!;
    expect(within(skill).getByText("공고 통계 표본")).toBeInTheDocument();
    expect(within(skill).getByText("18건 공고")).toBeInTheDocument();
    expect(within(skill).getByText("필수 12 · 우대 4 · 미분류 2")).toBeInTheDocument();

    const community = screen
      .getByRole("link", { name: "Python에서 Go로 옮긴 경험이 궁금해요" })
      .closest("article")!;
    expect(within(community).getByText("예시 콘텐츠")).toBeInTheDocument();
    expect(
      within(community).getByRole("link", { name: "Python 커뮤니티 검색" }),
    ).toHaveAttribute("href", "/search?q=Python&scope=community");
    expect(screen.getByText(/실제 사용자가 작성한 글이 아닙니다/)).toBeInTheDocument();
  });

  it("labels a missing skill requirement breakdown instead of inventing zeroes", () => {
    render(
      <SearchResults
        snapshot={snapshot({
          scope: "skills",
          skills: [
            {
              ...snapshot().skills[0],
              requiredCount: null,
              preferredCount: null,
              unspecifiedCount: null,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText("필수·우대 분류 미제공")).toBeInTheDocument();
    expect(screen.queryByText(/필수 0/)).not.toBeInTheDocument();
  });

  it("shows only the selected result scope", () => {
    render(<SearchResults snapshot={snapshot({ scope: "skills" })} />);

    expect(screen.getByRole("heading", { name: "기술" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /기술.*1/ }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Python 스킬맵 보기" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Python Backend Engineer" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "NAVER 기업 채용 현황" }),
    ).not.toBeInTheDocument();
  });

  it("keeps successful evidence visible when one actual API fails", () => {
    render(
      <SearchResults
        snapshot={snapshot({
          dataStatus: "partial",
          companies: [],
          jobs: [],
          counts: { companies: null, jobs: null, skills: 1, community: 1 },
          errors: ["공고 검색 결과를 불러오지 못했습니다."],
        })}
      />,
    );

    expect(
      screen.getByText("일부 실제 검색 결과를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("공고 검색 결과를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Python 스킬맵 보기" })).toBeInTheDocument();
    expect(
      screen.queryByText("검색 결과가 없습니다."),
    ).not.toBeInTheDocument();
  });

  it("distinguishes a completed empty search from unavailable actual data", () => {
    const { rerender } = render(
      <SearchResults
        snapshot={snapshot({
          companies: [],
          jobs: [],
          skills: [],
          community: [],
          counts: { companies: 0, jobs: 0, skills: 0, community: 0 },
          hasAnyResults: false,
        })}
      />,
    );
    expect(screen.getByText("검색 결과가 없습니다.")).toBeInTheDocument();

    rerender(
      <SearchResults
        snapshot={snapshot({
          dataStatus: "error",
          companies: [],
          jobs: [],
          skills: [],
          community: [],
          counts: {
            companies: null,
            jobs: null,
            skills: null,
            community: 0,
          },
          errors: ["공고 검색 실패", "기술 검색 실패"],
          hasAnyResults: false,
        })}
      />,
    );
    expect(
      screen.getByText("실제 검색 데이터를 불러오지 못했습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("검색 결과가 없습니다.")).not.toBeInTheDocument();
  });
});
