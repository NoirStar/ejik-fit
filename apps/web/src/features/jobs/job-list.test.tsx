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
    expect(screen.getByText("현재 결과 2건")).toBeInTheDocument();
    expect(screen.getByText("기업 2곳")).toBeInTheDocument();
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
    expect(within(job).getByRole("link", { name: "공식 원문" })).toHaveAttribute(
      "href",
      "https://recruit.navercorp.com/job-1",
    );
    expect(screen.getByRole("link", { name: "필터 초기화" })).toHaveAttribute(
      "href",
      "/jobs",
    );
    expect(screen.queryByText(/합격 가능성|적합도 점수|AI 추천/)).not.toBeInTheDocument();

    expect(
      await screen.findByRole("button", { name: "Backend Engineer 저장" }),
    ).toHaveAttribute("aria-pressed", "false");
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

    fireEvent.click(
      await screen.findByRole("button", { name: "내 기술 겹침 1" }),
    );
    expect(screen.getByRole("link", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Go Platform Engineer" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Backend Engineer 저장" }));
    expect(
      JSON.parse(window.localStorage.getItem("ejik-fit:saved-job-ids")!),
    ).toEqual(["job-1"]);
    fireEvent.click(screen.getByRole("button", { name: "저장한 공고 1" }));
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

  it("distinguishes empty, missing-stack, and API error states", async () => {
    const { rerender } = render(
      <JobList
        filters={{ query: "rust", careerType: "", category: "" }}
        postings={{ items: [], total: 0 }}
      />,
    );

    expect(screen.getByText("조건에 맞는 공식 공고가 없습니다.")).toBeInTheDocument();
    expect(screen.getByText("검색 조건을 조정해 주세요.")).toBeInTheDocument();
    expect(screen.queryByText("공고 데이터를 불러오지 못했습니다.")).not.toBeInTheDocument();

    rerender(
      <JobList filters={{ query: "", careerType: "", category: "" }} postings={postings} />,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: "내 기술 겹침 0" }),
    );
    expect(screen.getByText("먼저 내 기술을 저장해 주세요.")).toBeInTheDocument();
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
    expect(screen.queryByText("조건에 맞는 공식 공고가 없습니다.")).not.toBeInTheDocument();
  });
});
