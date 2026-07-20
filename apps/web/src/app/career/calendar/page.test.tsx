import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getHiringOverview } from "@/lib/api";

import HiringCalendarPage from "./page";

vi.mock("@/lib/api", () => ({
  getHiringOverview: vi.fn(),
}));

describe("HiringCalendarPage", () => {
  beforeEach(() => {
    vi.mocked(getHiringOverview).mockReset();
    vi.mocked(getHiringOverview).mockResolvedValue({
      range_start: "2026-06-29",
      range_end: "2026-08-10",
      activity_since: "2026-07-07T00:00:00Z",
      deadline_total: 0,
      closing_next_7_days: 0,
      undated_open_postings: 12,
      activity_company_total: 0,
      deadlines: [],
      activities: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("requests the selected month calendar range from the real API boundary", async () => {
    render(
      await HiringCalendarPage({
        searchParams: Promise.resolve({ month: "2026-07" }),
      }),
    );

    expect(getHiringOverview).toHaveBeenCalledWith({
      start: "2026-06-29",
      end: "2026-08-10",
      activityDays: 14,
      limit: 300,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: "채용 일정" }),
    ).toBeInTheDocument();
    expect(screen.getByText("마감일 미표기").closest("div")).toHaveTextContent(
      "12건",
    );
  });
});
