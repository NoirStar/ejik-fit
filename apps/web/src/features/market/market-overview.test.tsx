import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PostingListResponse, SkillStatsResponse } from "@/lib/types";

import { MarketOverview } from "./market-overview";
import { buildMarketOverviewSnapshot } from "./model";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

const collectingTrend = {
  status: "collecting",
  collected_weeks: 2,
  minimum_weeks: 4,
  latest_snapshot_at: "2026-07-22T00:00:00Z",
  series: [],
} as const;

const readyTrend = {
  status: "ready",
  collected_weeks: 4,
  minimum_weeks: 4,
  latest_snapshot_at: "2026-07-22T00:00:00Z",
  series: [
    {
      skill: "Kubernetes",
      category: "infra",
      points: [
        {
          week_start: "2026-07-06",
          count: 30,
          required_count: 8,
          preferred_count: 4,
          unspecified_count: 18,
        },
        {
          week_start: "2026-07-13",
          count: 32,
          required_count: 9,
          preferred_count: 6,
          unspecified_count: 17,
        },
      ],
    },
  ],
} as const;

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
}));

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
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => collectingTrend,
      }),
    );
  });

  afterEach(() => {
    cleanup();
    replaceMock.mockReset();
    vi.unstubAllGlobals();
  });

  it("states the official-posting scope and filtered total honestly", () => {
    renderReadyMarket();

    expect(
      screen.getByRole("heading", { level: 1, name: "채용 시장 기술 동향" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "기업 채용공고에 많이 나온 기술과 최근 변화를 보여줍니다.",
      ),
    ).toBeInTheDocument();
    const scopeNotice = screen.getByLabelText("데이터 범위 안내");
    expect(scopeNotice).toHaveTextContent("기업 공식 채용 페이지 확인 범위");
    expect(scopeNotice).toHaveTextContent("국내 전체 채용시장 통계가 아닙니다");
    expect(
      screen.getByRole("region", { name: "현재 채용시장 요약" }),
    ).toHaveTextContent("100건 · 69종");
    expect(
      screen.queryByRole("region", { name: "채용 시장 데이터 요약" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("63%")).not.toBeInTheDocument();
    expect(screen.queryByText(/한국 개발자 채용시장/)).not.toBeInTheDocument();
  });

  it("renders ranked explicit demand with brand and neutral icons", () => {
    renderReadyMarket();

    const demand = screen.getByRole("region", { name: "기술 수요" });
    expect(
      within(demand).getByRole("heading", { level: 2, name: "기술 수요" }),
    ).toBeInTheDocument();
    expect(within(demand).getByText("미표기")).toBeInTheDocument();
    expect(
      within(demand).getByRole("button", { name: "Kubernetes 기술 선택" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(demand).getByRole("button", { name: "Kubernetes 기술 선택" }),
    ).toHaveAccessibleDescription(
      "인프라, 명시 요구 9건, 필수 5건, 우대 4건, 전체 등장 12건, 필수·우대 미표기 3건, 1위 대비 막대 길이 100%",
    );
    expect(
      within(demand).getByRole("button", { name: "Docker 기술 선택" }),
    ).toHaveAttribute("aria-pressed", "false");
    const kubernetesRow = within(demand)
      .getByRole("button", { name: "Kubernetes 기술 선택" })
      .closest("li");
    expect(kubernetesRow).not.toBeNull();
    expect(within(kubernetesRow!).getByText("필수 5건")).toBeInTheDocument();
    expect(within(kubernetesRow!).getByText("우대 4건")).toBeInTheDocument();
    expect(within(kubernetesRow!).getByText("미표기 3건")).toBeInTheDocument();
    expect(screen.getAllByText(/미표기 3건/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        "공고에 기술은 나오지만 필수 또는 우대로 구분되어 있지 않은 경우입니다.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/구분 안 됨/)).not.toBeInTheDocument();
    expect(within(demand).getByText(/1위 대비 길이/)).toBeInTheDocument();
    expect(
      demand.querySelector('[data-technology-icon="kubernetes"]'),
    ).not.toBeNull();
    expect(demand.querySelector('[data-technology-icon="cpu"]')).not.toBeNull();
    expect(
      within(demand).getByRole("link", { name: "Kubernetes 관련 공고 보기" }),
    ).toHaveAttribute("href", "/jobs?q=Kubernetes&career_type=experienced");
  });

  it("updates selected technology evidence when a technology is selected", () => {
    renderReadyMarket();

    expect(
      screen.getByRole("region", { name: "Kubernetes 시장 근거" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /플랫폼 엔지니어/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Docker 기술 선택" }));

    expect(
      screen.getByRole("region", { name: "Docker 시장 근거" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /컨테이너 인프라 개발자/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /플랫폼 엔지니어/ })).not.toBeInTheDocument();
  });

  it("keeps current evidence visible while a filter route is pending", () => {
    renderReadyMarket();

    fireEvent.click(
      within(
        screen.getByRole("navigation", { name: "포함 기술 분야" }),
      ).getByRole(
        "link",
        { name: "인프라" },
      ),
    );

    expect(replaceMock).toHaveBeenCalledWith(
      "/market?category=infra&career_type=experienced",
      { scroll: false },
    );
    expect(
      screen.getByRole("region", { name: "시장 범위 필터" }),
    ).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "필터 결과를 업데이트하는 중입니다.",
    );
    expect(
      screen.getByRole("button", { name: "Kubernetes 기술 선택" }),
    ).toBeInTheDocument();
  });

  it("shows a collecting state instead of fabricated trend lines", async () => {
    renderReadyMarket();

    const trend = screen.getByRole("region", { name: "기술 수요 추세" });
    expect(within(trend).getByText("추세 수집 중")).toBeInTheDocument();
    expect(
      await within(trend).findByText(
        "2주치 데이터가 쌓였습니다. 4주부터 변화선을 표시합니다.",
      ),
    ).toBeInTheDocument();
    expect(
      within(trend).getByText(
        "수집된 공고만 사용하며 빠진 주차를 임의로 채우지 않습니다.",
      ),
    ).toBeInTheDocument();
    expect(within(trend).queryByText(/UI 시안용/)).not.toBeInTheDocument();
    expect(within(trend).queryByText(/증가|감소|예측/)).not.toBeInTheDocument();
    expect(trend.querySelector("path[data-trend-line]")).toBeNull();
  });

  it("describes trend loading directly", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    renderReadyMarket();

    const trend = screen.getByRole("region", { name: "기술 수요 추세" });
    expect(
      within(trend).getByText("주간 추세를 불러오고 있습니다."),
    ).toBeInTheDocument();
  });

  it("keeps demand and jobs available when trend loading fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false }),
    );
    renderReadyMarket();

    const trend = screen.getByRole("region", { name: "기술 수요 추세" });
    expect(
      await within(trend).findByText(
        "주간 추세를 불러오지 못했습니다. 기술 수요와 관련 공고는 정상적으로 표시됩니다.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "기술 수요" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /플랫폼 엔지니어/ }),
    ).toBeInTheDocument();
  });

  it("renders explicit weekly change only when real trend data is ready", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => readyTrend,
      }),
    );
    renderReadyMarket();

    expect(await screen.findByText("전주 대비 +3건")).toBeInTheDocument();
    expect(screen.getByText("전체 경력·전체 분야 기준")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /주차 명시 요구 변화/ }),
    ).toBeInTheDocument();
  });

  it("keeps market evidence separate from personal learning guidance", () => {
    renderReadyMarket();

    expect(screen.queryByText(/내 기술을 저장하면/)).not.toBeInTheDocument();
    expect(screen.queryByText(/다음 학습 후보/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Kubernetes 시장 근거" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "포함 기술 분야" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/선택 분야 포함 공고의 모든 기술/),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "LLM 기술 선택" }));
    expect(
      screen.getByRole("region", { name: "LLM 시장 근거" }),
    ).toHaveTextContent("Python");
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
    expect(
      screen.getByRole("region", { name: "현재 채용시장 요약" }),
    ).toHaveTextContent("확인 불가 · 69종");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "공고 데이터를 불러오지 못했습니다.",
    );
    const evidence = screen.getByRole("region", {
      name: "Kubernetes 시장 근거",
    });
    expect(evidence).toHaveTextContent(
      "공고 데이터를 불러오지 못했습니다.",
    );
    expect(evidence).toHaveTextContent(
      "기술 수요는 정상적으로 표시됩니다.",
    );
  });

  it("does not claim related jobs are normal when postings and trends fail", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
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

    const trend = screen.getByRole("region", { name: "기술 수요 추세" });
    expect(
      await within(trend).findByText(
        "주간 추세를 불러오지 못했습니다. 기술 수요는 정상적으로 표시됩니다.",
      ),
    ).toBeInTheDocument();
    expect(
      within(trend).queryByText(/관련 공고는 정상적으로 표시됩니다/),
    ).not.toBeInTheDocument();
  });

  it("does not claim a posting list is shown when skill statistics fail", () => {
    render(
      <MarketOverview
        snapshot={buildMarketOverviewSnapshot({
          careerType: "",
          postings: { status: "ready", data: postings },
          skillStats: {
            status: "error",
            message: "기술 수요 데이터를 불러오지 못했습니다.",
          },
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "기술 수요 데이터를 불러오지 못했습니다.",
    );
    expect(
      screen.queryByText("공고 목록은 정상적으로 표시됩니다."),
    ).not.toBeInTheDocument();
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
