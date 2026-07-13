import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PostingListResponse, SkillStatsResponse } from "@/lib/types";

import { MarketOverview } from "./market-overview";
import { buildMarketOverviewSnapshot } from "./model";

const postings: PostingListResponse = {
  total: 2,
  items: [
    {
      id: "job-1",
      title: "플랫폼 엔지니어",
      company_name: "새회사",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://example.com/jobs/1",
      last_verified_at: "2026-07-14T03:00:00Z",
    },
  ],
};

const skillStats: SkillStatsResponse = {
  total: 1,
  items: [
    {
      skill: "Kubernetes",
      category: "infra",
      count: 12,
      required_count: 5,
      preferred_count: 4,
      unspecified_count: 3,
    },
  ],
};

describe("MarketOverview", () => {
  afterEach(() => cleanup());

  it("renders API-backed demand without invented trends", () => {
    render(
      <MarketOverview
        snapshot={buildMarketOverviewSnapshot({
          careerType: "experienced",
          postings: { status: "ready", data: postings },
          skillStats: { status: "ready", data: skillStats },
        })}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "채용 시장", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "경력" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByText("공개 공고").closest("div")).toHaveTextContent(
      "2건",
    );
    expect(screen.getByText("확인 기술").closest("div")).toHaveTextContent(
      "1개",
    );
    expect(
      screen.getByRole("link", { name: "Kubernetes 스킬맵" }),
    ).toHaveAttribute("href", "/skill-map?skill=Kubernetes");
    expect(
      screen.getByRole("link", { name: "Kubernetes 관련 공고" }),
    ).toHaveAttribute(
      "href",
      "/jobs?q=Kubernetes&career_type=experienced",
    );
    expect(screen.getByText("필수 5건")).toBeInTheDocument();
    expect(screen.getByText("우대 4건")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /플랫폼 엔지니어/ })).toHaveAttribute(
      "href",
      "/jobs/job-1",
    );
    expect(screen.queryByText(/증가|감소|실시간|예측/)).not.toBeInTheDocument();
  });

  it("keeps skill demand visible when postings fail", () => {
    render(
      <MarketOverview
        snapshot={buildMarketOverviewSnapshot({
          careerType: "",
          postings: {
            status: "error",
            message: "공고 데이터를 불러오지 못했습니다.",
          },
          skillStats: { status: "ready", data: skillStats },
        })}
      />,
    );

    expect(
      screen.getAllByText("공고 데이터를 불러오지 못했습니다.").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("공개 공고").closest("div")).toHaveTextContent(
      "확인 불가",
    );
  });

  it("distinguishes empty market results from errors", () => {
    render(
      <MarketOverview
        snapshot={buildMarketOverviewSnapshot({
          careerType: "new_comer",
          postings: { status: "ready", data: { total: 0, items: [] } },
          skillStats: { status: "ready", data: { total: 0, items: [] } },
        })}
      />,
    );

    expect(
      screen.getByText("이 조건에서 확인된 기술 수요가 없습니다."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("이 조건에서 확인된 공개 공고가 없습니다."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "전체 시장 보기" })).toHaveAttribute(
      "href",
      "/market",
    );
  });
});
