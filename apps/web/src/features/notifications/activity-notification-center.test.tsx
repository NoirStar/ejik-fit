import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ActivityNotificationCenter } from "./activity-notification-center";

describe("ActivityNotificationCenter", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ items: [], total: 0 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("does not invent notifications when there is no saved activity", async () => {
    render(<ActivityNotificationCenter />);

    expect(
      await screen.findByText("아직 확인할 활동이 없습니다."),
    ).toBeInTheDocument();
  });

  it("links saved jobs, application stages, and skills to their real destinations", async () => {
    localStorage.setItem(
      "ejik-fit:saved-job-ids",
      JSON.stringify(["job-1", "job-2"]),
    );
    localStorage.setItem(
      "ejik-fit:job-application-stages",
      JSON.stringify({ "job-1": "interview" }),
    );
    localStorage.setItem(
      "ejik-fit:owned-skills",
      JSON.stringify(["Python", "Kubernetes"]),
    );
    localStorage.setItem(
      "ejik-fit:followed-company-slugs",
      JSON.stringify(["naver"]),
    );

    render(<ActivityNotificationCenter />);

    await waitFor(() => {
      expect(screen.getByText("지원 기록 1건")).toBeInTheDocument();
    });
    expect(screen.getByText("면접 진행 1건")).toBeInTheDocument();
    expect(screen.getByText("저장한 공고 2건")).toBeInTheDocument();
    expect(screen.getByText("내 기술 2개")).toBeInTheDocument();
    expect(screen.getByText("관심 기업 1개")).toBeInTheDocument();
    expect(screen.getByText("지원 기록 1건").closest("a")).toHaveAttribute(
      "href",
      "/career/saved?scope=applications",
    );
    expect(screen.getByText("내 기술 2개").closest("a")).toHaveAttribute(
      "href",
      "/market",
    );
    expect(screen.getByText("관심 기업 1개").closest("a")).toHaveAttribute(
      "href",
      "/career/companies",
    );
  });

  it("shows newly discovered jobs from followed companies once", async () => {
    localStorage.setItem(
      "ejik-fit:followed-company-slugs",
      JSON.stringify(["naver"]),
    );
    localStorage.setItem(
      "ejik-fit:company-job-notifications-checked-at",
      "2026-07-14T00:00:00.000Z",
    );
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          total: 1,
          items: [
            {
              id: "new-job",
              title: "검색 플랫폼 백엔드 개발자",
              company_name: "네이버",
              company_slug: "naver",
              career_type: "experienced",
              employment_type: "정규직",
              career_min: 3,
              career_max: null,
              location: "성남",
              status: "open",
              source_url: "https://recruit.navercorp.com/new-job",
              first_seen_at: "2026-07-15T03:00:00.000Z",
              last_verified_at: "2026-07-15T04:00:00.000Z",
              opens_at: null,
              closes_at: null,
              required_skills: ["Java"],
              preferred_skills: [],
              unspecified_skills: [],
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<ActivityNotificationCenter />);

    const alert = await screen.findByText("네이버 · 새로 확인");
    expect(alert.closest("a")).toHaveAttribute("href", "/jobs/new-job");
    expect(screen.getByText("검색 플랫폼 백엔드 개발자")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/notifications/company-jobs",
      expect.objectContaining({ method: "POST" }),
    );
    expect(
      Date.parse(
        localStorage.getItem(
          "ejik-fit:company-job-notifications-checked-at",
        ) ?? "",
      ),
    ).toBeGreaterThan(Date.parse("2026-07-14T00:00:00.000Z"));
  });
});
