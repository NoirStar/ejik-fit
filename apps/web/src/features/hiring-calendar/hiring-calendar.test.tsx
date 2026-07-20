import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { writeFollowedCompanySlugs } from "@/lib/followed-companies";
import { writeSavedJobIds } from "@/lib/saved-jobs";
import type { HiringOverviewResponse } from "@/lib/types";

import { HiringCalendar } from "./hiring-calendar";
import { buildHiringCalendarModel } from "./model";

const overview: HiringOverviewResponse = {
  range_start: "2026-06-29",
  range_end: "2026-08-10",
  activity_since: "2026-07-07T00:00:00Z",
  deadline_total: 3,
  closing_next_7_days: 1,
  undated_open_postings: 42,
  activity_company_total: 2,
  deadlines: [
    {
      id: "job-nexon",
      title: "게임 서버 프로그래머",
      company_name: "넥슨코리아",
      company_slug: "nexon",
      career_type: "experienced",
      employment_type: "regular",
      career_min: 3,
      career_max: null,
      location: "판교",
      status: "open",
      source_url: "https://careers.nexon.com/recruit/1",
      first_seen_at: "2026-07-19T02:00:00Z",
      last_verified_at: "2026-07-20T03:00:00Z",
      opens_at: null,
      closes_at: "2026-07-21T14:59:00Z",
    },
    {
      id: "job-naver",
      title: "AI 플랫폼 엔지니어",
      company_name: "네이버랩스",
      company_slug: "naver-labs",
      career_type: "mixed",
      employment_type: "regular",
      career_min: null,
      career_max: null,
      location: "성남",
      status: "open",
      source_url: "https://recruit.naverlabs.com/jobs/2",
      first_seen_at: "2026-07-18T02:00:00Z",
      last_verified_at: "2026-07-20T03:00:00Z",
      opens_at: null,
      closes_at: "2026-07-28T14:59:00Z",
    },
    {
      id: "job-undated",
      title: "마감일을 알 수 없는 공고",
      company_name: "확인기업",
      company_slug: "unknown-company",
      career_type: null,
      employment_type: null,
      career_min: null,
      career_max: null,
      location: null,
      status: "open",
      source_url: "https://example.com/jobs/undated",
      first_seen_at: "2026-07-20T02:00:00Z",
      last_verified_at: "2026-07-20T03:00:00Z",
      opens_at: null,
      closes_at: null,
    },
  ],
  activities: [
    {
      company_name: "넥슨코리아",
      company_slug: "nexon",
      new_postings: 7,
      latest_first_seen_at: "2026-07-20T02:00:00Z",
      nearest_deadline_at: "2026-07-21T14:59:00Z",
    },
    {
      company_name: "네이버랩스",
      company_slug: "naver-labs",
      new_postings: 2,
      latest_first_seen_at: "2026-07-18T02:00:00Z",
      nearest_deadline_at: "2026-07-28T14:59:00Z",
    },
  ],
};

function renderCalendar() {
  return render(
    <HiringCalendar
      model={buildHiringCalendarModel(overview, "2026-07", "2026-07-20")}
    />,
  );
}

describe("HiringCalendar", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders only verified explicit deadlines in the selected month", () => {
    renderCalendar();

    expect(
      screen.getByRole("heading", { level: 1, name: "채용 일정" }),
    ).toBeInTheDocument();
    expect(screen.getByText("선택 월 마감").closest("div")).toHaveTextContent(
      "2건",
    );
    expect(screen.getByText("마감일 미표기").closest("div")).toHaveTextContent(
      "42건",
    );

    const calendar = screen.getByRole("region", {
      name: "2026년 7월 채용 달력",
    });
    expect(
      within(calendar).getByRole("link", {
        name: /넥슨코리아 게임 서버 프로그래머/,
      }),
    ).toHaveAttribute("href", "/jobs/job-nexon");
    expect(
      within(calendar).getByRole("link", {
        name: /네이버랩스 AI 플랫폼 엔지니어/,
      }),
    ).toBeInTheDocument();
    expect(
      within(calendar).queryByText("마감일을 알 수 없는 공고"),
    ).not.toBeInTheDocument();
  });

  it("filters the same calendar by saved jobs and followed companies", () => {
    writeSavedJobIds(["job-naver"]);
    writeFollowedCompanySlugs(["nexon"]);
    renderCalendar();

    const calendar = screen.getByRole("region", {
      name: "2026년 7월 채용 달력",
    });

    fireEvent.click(screen.getByRole("button", { name: "저장 공고" }));
    expect(
      within(calendar).getByRole("link", {
        name: /네이버랩스 AI 플랫폼 엔지니어/,
      }),
    ).toBeInTheDocument();
    expect(
      within(calendar).queryByRole("link", {
        name: /넥슨코리아 게임 서버 프로그래머/,
      }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "관심 기업" }));
    expect(
      within(calendar).getByRole("link", {
        name: /넥슨코리아 게임 서버 프로그래머/,
      }),
    ).toBeInTheDocument();
    expect(
      within(calendar).queryByRole("link", {
        name: /네이버랩스 AI 플랫폼 엔지니어/,
      }),
    ).not.toBeInTheDocument();
  });

  it("keeps the upcoming panel compact and expands only on request", () => {
    const manyDeadlines: HiringOverviewResponse = {
      ...overview,
      deadline_total: 12,
      deadlines: Array.from({ length: 12 }, (_, index) => ({
        ...overview.deadlines[0],
        id: `job-${index + 1}`,
        title: `마감 예정 공고 ${index + 1}`,
        closes_at: `2026-07-${String(
          21 + Math.floor(index / 2),
        ).padStart(2, "0")}T14:59:00Z`,
      })),
    };

    render(
      <HiringCalendar
        model={buildHiringCalendarModel(
          manyDeadlines,
          "2026-07",
          "2026-07-20",
        )}
      />,
    );

    const upcoming = screen.getByRole("region", {
      name: "가까운 마감 공고",
    });
    expect(
      within(upcoming).getAllByRole("link", { name: /상세 보기/ }),
    ).toHaveLength(8);

    fireEvent.click(
      within(upcoming).getByRole("button", { name: "4건 더 보기" }),
    );

    expect(
      within(upcoming).getAllByRole("link", { name: /상세 보기/ }),
    ).toHaveLength(12);
    expect(
      within(upcoming).queryByRole("button", { name: /더 보기/ }),
    ).not.toBeInTheDocument();
  });
});
