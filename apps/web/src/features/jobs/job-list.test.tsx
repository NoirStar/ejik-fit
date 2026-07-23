import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeOwnedSkills } from "@/lib/owned-skills";
import type { PostingListResponse } from "@/lib/types";

import { JobList } from "./job-list";

const postings: PostingListResponse = {
  total: 2,
  items: [
    {
      id: "job-1",
      title: "Backend Engineer",
      company_name: "NAVER",
      company_slug: "naver",
      career_type: "experienced",
      employment_type: "FULL_TIME",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://recruit.navercorp.com/job-1",
      last_verified_at: "2026-07-14T03:00:00.000Z",
      closes_at: "2026-07-31T03:00:00.000Z",
      required_skills: ["Python", "Docker"],
      preferred_skills: ["Kubernetes"],
      unspecified_skills: [],
    },
    {
      id: "job-2",
      title: "Go Platform Engineer",
      company_name: "라인플러스",
      company_slug: "line-plus",
      career_type: "new_comer",
      employment_type: "FULL_TIME_WORKER",
      career_min: null,
      career_max: null,
      location: "성남",
      status: "open",
      source_url: "https://careers.linecorp.com/job-2",
      last_verified_at: "2026-07-13T03:00:00.000Z",
      required_skills: ["Go"],
      preferred_skills: [],
      unspecified_skills: ["Linux"],
    },
  ],
};

describe("JobList", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it("renders URL filters and verified requirement evidence", async () => {
    render(
      <JobList
        filters={{ query: "backend", careerType: "experienced", category: "infra" }}
        postings={postings}
      />,
    );

    expect(screen.getByLabelText("공고 검색")).toHaveValue("backend");
    expect(screen.getByLabelText("경력 조건")).toHaveValue("experienced");
    expect(screen.getByLabelText("기술 분야")).toHaveValue("infra");
    expect(
      screen.getByRole("heading", { level: 1, name: "채용공고" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("기술·직무·기업으로 공고를 찾고 내 기술과 비교합니다."),
    ).toBeInTheDocument();
    expect(screen.getByText("전체 공식 공고 2건")).toBeInTheDocument();
    expect(screen.getByText("현재 목록")).toBeInTheDocument();
    expect(screen.getByTitle("네이버 로고")).toBeInTheDocument();

    const job = screen
      .getByRole("link", { name: "Backend Engineer" })
      .closest("article")!;
    expect(
      within(job).getByRole("link", { name: "NAVER 기업 채용 현황" }),
    ).toHaveAttribute("href", "/companies/naver");
    expect(within(job).getByText("경력 3~7년")).toBeInTheDocument();
    expect(within(job).getByText("7월 31일 마감")).toBeInTheDocument();
    expect(within(job).getByText("필수 기술").parentElement).toHaveTextContent(
      "Python",
    );
    expect(within(job).getByText("우대 기술").parentElement).toHaveTextContent(
      "Kubernetes",
    );
    expect(within(job).getByRole("link", { name: "Python 스킬맵" })).toHaveAttribute(
      "href",
      "/skill-map?skill=Python",
    );
    const internalDetailLink = within(job).getByRole("link", {
      name: "기술 요건 보기",
    });
    expect(internalDetailLink).toHaveAttribute("href", "/jobs/job-1");
    expect(internalDetailLink).not.toHaveAttribute("target");
    const companyPageLink = within(job).getByRole("link", {
      name: "기업 채용페이지 보기",
    });
    expect(companyPageLink).toHaveAttribute(
      "href",
      "https://recruit.navercorp.com/job-1",
    );
    expect(companyPageLink).toHaveAttribute("target", "_blank");
    expect(companyPageLink).toHaveAttribute("rel", "noreferrer");
    expect(screen.getByText("필수·우대 미표기").parentElement).toHaveTextContent(
      "Linux",
    );
    expect(screen.queryByText(/내 스택/)).not.toBeInTheDocument();
    const resetLink = screen.getByRole("link", { name: "전체 공고 보기" });
    expect(resetLink).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(resetLink).not.toHaveAttribute("target");
    expect(screen.queryByText(/합격 가능성|적합도 점수|AI 추천/)).not.toBeInTheDocument();

    expect(
      await screen.findByRole("button", { name: "Backend Engineer 저장" }),
    ).toHaveAttribute("aria-pressed", "false");

    const sourceNotice = screen.getByText(
      "지원하기 전에 기업 채용페이지에서 최신 내용을 확인해 주세요.",
    );
    expect(
      screen.getAllByText(
        "지원하기 전에 기업 채용페이지에서 최신 내용을 확인해 주세요.",
      ),
    ).toHaveLength(1);
    expect(
      screen
        .getByRole("link", { name: "Go Platform Engineer" })
        .closest("ul")!
        .compareDocumentPosition(sourceNotice) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps a plain company label for an older response without a slug", () => {
    render(
      <JobList
        filters={{ query: "", careerType: "", category: "" }}
        postings={{
          items: [{ ...postings.items[0], company_slug: undefined }],
          total: 1,
        }}
      />,
    );

    expect(screen.getByText("NAVER")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "NAVER 기업 채용 현황" }),
    ).not.toBeInTheDocument();
  });

  it("switches between skill overlap and browser-saved views", async () => {
    window.localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python"]),
    );
    render(
      <JobList filters={{ query: "", careerType: "", category: "" }} postings={postings} />,
    );

    expect(screen.getByRole("button", { name: "전체 공고 2" })).toHaveTextContent(
      /^전체\s*2$/,
    );
    expect(
      await screen.findByRole("button", { name: "내 기술 겹침 1" }),
    ).toHaveTextContent(/^기술 일치\s*1$/);
    expect(screen.getByRole("button", { name: "저장 목록 0" })).toHaveTextContent(
      /^저장\s*0$/,
    );
    expect(screen.queryByText("이 페이지")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "저장 목록 0" }));
    expect(screen.getByText("저장한 공고가 없습니다.")).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "내 기술 겹침 1" }),
    );
    expect(screen.getByRole("link", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Go Platform Engineer" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Backend Engineer 저장" }));
    expect(
      JSON.parse(window.localStorage.getItem("ejik-fit:saved-job-ids")!),
    ).toEqual(["job-1"]);
    fireEvent.click(screen.getByRole("button", { name: "저장 목록 1" }));
    expect(screen.getByRole("link", { name: "Backend Engineer" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "내 기술 겹침 1" }));
    act(() => writeOwnedSkills(["Go"]));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Go Platform Engineer" })).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("link", { name: "Backend Engineer" }),
    ).not.toBeInTheDocument();
  });

  it("keeps uncontrolled filter controls synchronized with URL props", () => {
    const { rerender } = render(
      <JobList
        filters={{ query: "backend", careerType: "experienced", category: "infra" }}
        postings={postings}
      />,
    );
    fireEvent.change(screen.getByLabelText("공고 검색"), {
      target: { value: "edited" },
    });

    rerender(
      <JobList filters={{ query: "", careerType: "", category: "" }} postings={postings} />,
    );

    expect(screen.getByLabelText("공고 검색")).toHaveValue("");
    expect(screen.getByLabelText("경력 조건")).toHaveValue("");
    expect(screen.getByLabelText("기술 분야")).toHaveValue("");
  });

  it("links server pages without rendering jobs that were not fetched", () => {
    const manyPostings: PostingListResponse = {
      total: 21,
      items: Array.from({ length: 20 }, (_, index) => ({
        ...postings.items[0],
        id: `page-job-${index + 1}`,
        title: `페이지 공고 ${index + 1}`,
        source_url: `https://recruit.navercorp.com/page-job-${index + 1}`,
      })),
    };

    const { rerender } = render(
      <JobList
        currentPage={1}
        filters={{ query: "", careerType: "", category: "" }}
        pageSize={20}
        postings={manyPostings}
      />,
    );

    expect(screen.getByRole("link", { name: "페이지 공고 1" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "페이지 공고 21" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("1-20 / 21건")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "2페이지" })).toHaveAttribute(
      "href",
      "/jobs?page=2",
    );

    rerender(
      <JobList
        currentPage={2}
        filters={{ query: "", careerType: "", category: "" }}
        pageSize={20}
        postings={{
          total: 21,
          items: [
            {
              ...postings.items[0],
              id: "page-job-21",
              title: "페이지 공고 21",
              source_url: "https://recruit.navercorp.com/page-job-21",
            },
          ],
        }}
      />,
    );

    expect(
      screen.queryByRole("link", { name: "페이지 공고 1" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "페이지 공고 21" })).toBeInTheDocument();
    expect(screen.getByText("21-21 / 21건")).toBeInTheDocument();
  });

  it("shows filter guidance and a whole-list action for an empty filtered result", () => {
    render(
      <JobList
        filters={{ query: "rust", careerType: "", category: "" }}
        postings={{ items: [], total: 0 }}
      />,
    );

    expect(
      screen.getByText(
        "조건에 맞는 공고가 없습니다. 검색어나 필터를 줄여 주세요.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("공고 데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();
    const wholeListLinks = screen.getAllByRole("link", {
      name: "전체 공고 보기",
    });
    expect(wholeListLinks).toHaveLength(2);
    for (const link of wholeListLinks) {
      expect(link).toHaveAttribute("href", "/jobs");
      expect(link).not.toHaveAttribute("target");
    }
  });

  it("explains an out-of-range page and returns to the first whole list", () => {
    render(
      <JobList
        currentPage={3}
        filters={{ query: "", careerType: "", category: "" }}
        postings={{ items: [], total: 2 }}
      />,
    );

    expect(
      screen.getByText("요청한 페이지는 공고 목록 범위를 벗어났습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "조건에 맞는 공고가 없습니다. 검색어나 필터를 줄여 주세요.",
      ),
    ).not.toBeInTheDocument();
    const firstPageLink = screen.getByRole("link", {
      name: "전체 공고 보기",
    });
    expect(firstPageLink).toHaveAttribute("href", "/jobs");
    expect(firstPageLink).not.toHaveAttribute("target");
  });

  it("states an unfiltered zero-result list without suggesting filters", () => {
    render(
      <JobList
        filters={{ query: "", careerType: "", category: "" }}
        postings={{ items: [], total: 0 }}
      />,
    );

    expect(
      screen.getByText("현재 확인할 수 있는 공고가 없습니다."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "조건에 맞는 공고가 없습니다. 검색어나 필터를 줄여 주세요.",
      ),
    ).not.toBeInTheDocument();
  });

  it("distinguishes missing-stack and unavailable-data states", async () => {
    const { rerender } = render(
      <JobList filters={{ query: "", careerType: "", category: "" }} postings={postings} />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "내 기술 겹침 0" }),
    );
    expect(screen.getByText("먼저 내 기술을 저장해 주세요.")).toBeInTheDocument();
    expect(
      screen.getByText("내 기술을 추가하면 공고의 기술 요건과 비교합니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "내 커리어에서 기술 추가" })).toHaveAttribute(
      "href",
      "/career",
    );

    rerender(
      <JobList
        error
        filters={{ query: "rust", careerType: "", category: "" }}
        postings={null}
      />,
    );
    expect(screen.getByText("공고 데이터를 불러오지 못했습니다.")).toBeInTheDocument();
    expect(
      screen.getByText("채용공고 데이터를 확인할 수 없습니다"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/API/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        "조건에 맞는 공고가 없습니다. 검색어나 필터를 줄여 주세요.",
      ),
    ).not.toBeInTheDocument();
  });
});
