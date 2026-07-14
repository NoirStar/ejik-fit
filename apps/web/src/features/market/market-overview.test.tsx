import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { PostingListResponse, SkillStatsResponse } from "@/lib/types";

import { MarketOverview } from "./market-overview";
import { buildMarketOverviewSnapshot } from "./model";

const postings: PostingListResponse = {
  total: 100,
  items: [
    {
      id: "job-kubernetes",
      title: "플랫폼 엔지니어",
      company_name: "새회사",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 3,
      career_max: 7,
      location: "서울",
      status: "open",
      source_url: "https://example.com/jobs/kubernetes",
      last_verified_at: "2026-07-14T03:00:00Z",
      required_skills: ["Kubernetes"],
      preferred_skills: [],
      unspecified_skills: [],
    },
    {
      id: "job-docker",
      title: "컨테이너 인프라 개발자",
      company_name: "예시회사",
      career_type: "new_comer",
      employment_type: "FULL_TIME_WORKER",
      career_min: null,
      career_max: null,
      location: "판교",
      status: "open",
      source_url: "https://example.org/jobs/docker",
      last_verified_at: "2026-07-14T02:00:00Z",
      required_skills: ["Docker"],
      preferred_skills: [],
      unspecified_skills: [],
    },
    {
      id: "job-both",
      title: "클라우드 백엔드 개발자",
      company_name: "공식회사",
      career_type: "mixed",
      employment_type: null,
      career_min: null,
      career_max: null,
      location: null,
      status: "open",
      source_url: "https://example.net/jobs/cloud",
      last_verified_at: "invalid-date",
      required_skills: ["Kubernetes"],
      preferred_skills: ["Docker"],
      unspecified_skills: [],
    },
    {
      id: "job-ai",
      title: "생성형 AI 엔지니어",
      company_name: "데이터회사",
      career_type: "experienced",
      employment_type: "FULL_TIME_WORKER",
      career_min: 2,
      career_max: null,
      location: "서울",
      status: "open",
      source_url: "https://example.ai/jobs/llm",
      last_verified_at: "2026-07-14T01:00:00Z",
      required_skills: ["LLM"],
      preferred_skills: ["Python"],
      unspecified_skills: [],
    },
  ],
};

const skillStats: SkillStatsResponse = {
  total: 69,
  items: [
    {
      skill: "Kubernetes",
      category: "infra",
      count: 12,
      required_count: 5,
      preferred_count: 4,
      unspecified_count: 3,
    },
    {
      skill: "Docker",
      category: "infra",
      count: 9,
      required_count: 4,
      preferred_count: 3,
      unspecified_count: 2,
    },
    {
      skill: "LLM",
      category: "ai",
      count: 7,
      required_count: 5,
      preferred_count: 1,
      unspecified_count: 1,
    },
  ],
};

function renderReadyMarket() {
  return render(
    <MarketOverview
      snapshot={buildMarketOverviewSnapshot({
        careerType: "experienced",
        postings: { status: "ready", data: postings },
        skillStats: { status: "ready", data: skillStats },
      })}
    />,
  );
}

describe("MarketOverview", () => {
  afterEach(() => cleanup());

  it("states the official-posting scope and capped totals honestly", () => {
    renderReadyMarket();

    expect(
      screen.getByRole("heading", { name: "채용 시장", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/이직핏이 확인한 기업 공식 채용 공고 범위/),
    ).toBeInTheDocument();
    expect(screen.getByText(/국내 전체 채용시장을 의미하지 않습니다/)).toBeInTheDocument();
    expect(screen.getByText("확인된 공고").closest("div")).toHaveTextContent(
      "100건 이상 확인",
    );
    expect(screen.getByText("확인된 기술").closest("div")).toHaveTextContent(
      "69종",
    );
    expect(screen.getByText("데이터 출처").closest("div")).toHaveTextContent(
      "기업 공식 채용 홈페이지",
    );
    expect(screen.queryByText("63%")).not.toBeInTheDocument();
    expect(screen.queryByText(/한국 개발자 채용시장/)).not.toBeInTheDocument();
  });

  it("renders a ranked demand table with brand and neutral icons", () => {
    renderReadyMarket();

    const demand = screen.getByRole("region", { name: "기술 수요 순위" });
    expect(
      within(demand).getByRole("button", { name: "Kubernetes 기술 선택" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(demand).getByRole("button", { name: "Docker 기술 선택" }),
    ).toHaveAttribute("aria-pressed", "false");
    const kubernetesRow = within(demand)
      .getByRole("button", { name: "Kubernetes 기술 선택" })
      .closest("li");
    expect(kubernetesRow).not.toBeNull();
    expect(within(kubernetesRow!).getByText("필수 5건")).toBeInTheDocument();
    expect(within(kubernetesRow!).getByText("우대 4건")).toBeInTheDocument();
    expect(within(kubernetesRow!).getByText("미분류 3건")).toBeInTheDocument();
    expect(within(demand).getByText(/1위 기술 대비 상대적 수요/)).toBeInTheDocument();
    expect(
      demand.querySelector('[data-technology-icon="kubernetes"]'),
    ).not.toBeNull();
    expect(demand.querySelector('[data-technology-icon="cpu"]')).not.toBeNull();
    expect(
      within(demand).getByRole("link", { name: "Kubernetes 관련 공고 보기" }),
    ).toHaveAttribute("href", "/jobs?q=Kubernetes&career_type=experienced");
  });

  it("updates recent verified jobs when a technology is selected", () => {
    renderReadyMarket();

    expect(
      screen.getByRole("heading", { name: "Kubernetes 관련 최근 공고" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /플랫폼 엔지니어/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Docker 기술 선택" }));

    expect(
      screen.getByRole("heading", { name: "Docker 관련 최근 공고" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /컨테이너 인프라 개발자/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /플랫폼 엔지니어/ })).not.toBeInTheDocument();
  });

  it("shows a collecting state instead of fabricated trend lines", () => {
    renderReadyMarket();

    const trend = screen.getByRole("region", { name: "기술 수요 추세" });
    expect(within(trend).getByText("추세 수집 중")).toBeInTheDocument();
    expect(within(trend).getByText(/최근 12주의 변화/)).toBeInTheDocument();
    expect(within(trend).queryByText(/UI 시안용/)).not.toBeInTheDocument();
    expect(within(trend).queryByText(/증가|감소|예측/)).not.toBeInTheDocument();
    expect(trend.querySelector("path[data-trend-line]")).toBeNull();
  });

  it("labels co-occurrence as co-occurrence and keeps fit claims separate", () => {
    renderReadyMarket();

    const combinations = screen.getByRole("region", { name: "함께 등장한 기술" });
    expect(within(combinations).getByText("Docker + Kubernetes")).toBeInTheDocument();
    expect(within(combinations).getByText("함께 등장한 공고 1건")).toBeInTheDocument();
    expect(within(combinations).queryByText(/지원 가능한 공고.*증가/)).not.toBeInTheDocument();
    expect(screen.getByText(/내 기술을 저장하면/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "LLM 기술 선택" }));
    expect(within(combinations).getByText("LLM + Python")).toBeInTheDocument();
    expect(
      within(combinations).queryByText("Docker + Kubernetes"),
    ).not.toBeInTheDocument();
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
      screen.getByRole("button", { name: "Kubernetes 기술 선택" }),
    ).toBeInTheDocument();
    expect(screen.getByText("확인된 공고").closest("div")).toHaveTextContent(
      "확인 불가",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "공고 데이터를 불러오지 못했습니다.",
    );
  });

  it("shows one recovery state when both market requests fail", () => {
    render(
      <MarketOverview
        snapshot={buildMarketOverviewSnapshot({
          careerType: "experienced",
          postings: {
            status: "error",
            message: "공고 데이터를 불러오지 못했습니다.",
          },
          skillStats: {
            status: "error",
            message: "기술 수요 데이터를 불러오지 못했습니다.",
          },
        })}
      />,
    );

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "시장 데이터를 불러오지 못했습니다.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute(
      "href",
      "/market?career_type=experienced",
    );
  });

  it("distinguishes empty results from API errors", () => {
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
      screen.getByRole("heading", {
        level: 3,
        name: "선택한 조건에 해당하는 기술 데이터가 없습니다.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "필터 초기화" })).toHaveAttribute(
      "href",
      "/market",
    );
  });
});
