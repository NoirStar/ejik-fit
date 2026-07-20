import { describe, expect, it } from "vitest";

import type { HiringOverviewResponse } from "@/lib/types";

import {
  buildHiringCalendarModel,
  calendarRangeForMonth,
  normalizeMonthKey,
} from "./model";

const overview: HiringOverviewResponse = {
  range_start: "2026-06-29",
  range_end: "2026-08-10",
  activity_since: "2026-07-06T03:00:00Z",
  deadline_total: 2,
  closing_next_7_days: 1,
  undated_open_postings: 1400,
  activity_company_total: 1,
  deadlines: [
    {
      id: "job-1",
      title: "서버 개발자",
      company_name: "넥슨코리아",
      company_slug: "nexon",
      career_type: "experienced",
      employment_type: "regular",
      career_min: null,
      career_max: null,
      location: "판교",
      status: "open",
      source_url: "https://careers.nexon.com/recruit/1",
      first_seen_at: "2026-07-19T02:00:00Z",
      last_verified_at: "2026-07-20T03:00:00Z",
      opens_at: null,
      closes_at: "2026-07-20T15:00:00Z",
    },
    {
      id: "job-2",
      title: "AI 엔지니어",
      company_name: "네이버랩스",
      company_slug: "naver-labs",
      career_type: null,
      employment_type: null,
      career_min: null,
      career_max: null,
      location: null,
      status: "open",
      source_url: "https://example.com/jobs/2",
      first_seen_at: "2026-07-18T02:00:00Z",
      last_verified_at: "2026-07-20T03:00:00Z",
      opens_at: null,
      closes_at: "2026-08-03T14:59:00Z",
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
  ],
};

describe("hiring calendar model", () => {
  it("builds a stable six-week Monday-first calendar range", () => {
    expect(calendarRangeForMonth("2026-07")).toEqual({
      start: "2026-06-29",
      end: "2026-08-10",
    });
    expect(normalizeMonthKey("2026-13", "2026-07")).toBe("2026-07");
    expect(normalizeMonthKey("2026-08", "2026-07")).toBe("2026-08");
  });

  it("groups explicit deadlines by their Korea calendar date", () => {
    const model = buildHiringCalendarModel(
      overview,
      "2026-07",
      "2026-07-20",
    );

    expect(model.label).toBe("2026년 7월");
    expect(model.previousMonthKey).toBe("2026-06");
    expect(model.nextMonthKey).toBe("2026-08");
    expect(model.days).toHaveLength(42);
    expect(model.days[0]).toMatchObject({
      dateKey: "2026-06-29",
      inMonth: false,
    });
    expect(
      model.days.find((day) => day.dateKey === "2026-07-21")?.deadlines[0]
        .title,
    ).toBe("서버 개발자");
    expect(model.monthDeadlineCount).toBe(1);
    expect(model.monthDeadlines.map((item) => item.id)).toEqual(["job-1"]);
  });
});
