import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { DashboardSnapshot } from "./model";
import { DashboardHome } from "./dashboard-home";

function snapshot(
  overrides: Partial<DashboardSnapshot> = {},
): DashboardSnapshot {
  return {
    status: "ready",
    ownedSkills: ["Java", "Spring"],
    jobs: [
      {
        id: "job-1",
        title: "Backend Engineer",
        companyName: "토스",
        location: "서울",
        careerLabel: "경력",
        sourceUrl: "https://careers.toss.im/job-1",
        lastVerifiedLabel: "7월 13일",
        matchedSkills: ["Java", "Spring"],
        matchScore: 67,
      },
    ],
    skillDemand: [
      {
        label: "Kubernetes",
        count: 14,
        requiredCount: 8,
        preferredCount: 4,
      },
    ],
    adjacentSkills: [{ label: "Kafka", cooccurrenceCount: 5 }],
    displayedPostingCount: 1,
    displayedSourceCount: 1,
    matchingPostingCount: 1,
    lastVerifiedAt: "2026-07-12T15:00:00.000Z",
    fitLabel: "요구 기술 일치도",
    ...overrides,
  };
}

function expectNoFabricatedUi() {
  for (const text of [
    "김민준",
    "FIT SCORE 82%",
    "지난주 대비",
    "D-2",
    "7일",
    "30일",
    "90일",
  ]) {
    expect(screen.queryByText(text)).not.toBeInTheDocument();
  }
}

describe("DashboardHome", () => {
  afterEach(() => cleanup());

  it("renders actual ready data and source scope", () => {
    render(<DashboardHome resourceErrors={[]} snapshot={snapshot()} />);

    expect(screen.getByRole("heading", { name: "오늘의 공식 채용 신호" })).toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    expect(screen.getByText("1개 출처")).toBeInTheDocument();
    expect(screen.getByText("Kubernetes")).toBeInTheDocument();
    expect(screen.getByText("Kafka")).toBeInTheDocument();
    expectNoFabricatedUi();
  });

  it("makes partial data failure visible while keeping successful data", () => {
    render(
      <DashboardHome
        resourceErrors={["기술 그래프를 불러오지 못했습니다."]}
        snapshot={snapshot({ status: "partial" })}
      />,
    );

    expect(screen.getByText("일부 데이터를 불러오지 못했습니다")).toBeInTheDocument();
    expect(screen.getByText("토스")).toBeInTheDocument();
    expectNoFabricatedUi();
  });

  it("shows stack onboarding for an empty state", () => {
    render(
      <DashboardHome
        resourceErrors={[]}
        snapshot={snapshot({
          status: "empty",
          ownedSkills: [],
          jobs: [],
          skillDemand: [],
          adjacentSkills: [],
          displayedPostingCount: 0,
          displayedSourceCount: 0,
          matchingPostingCount: 0,
          lastVerifiedAt: null,
        })}
      />,
    );

    expect(screen.getByRole("heading", { name: "내 스택부터 설정해 주세요" })).toBeInTheDocument();
    expect(screen.getByText(/내 스택을 열어/)).toBeInTheDocument();
    expectNoFabricatedUi();
  });

  it("shows retry and data policy links for a complete error", () => {
    render(
      <DashboardHome
        resourceErrors={["API request failed"]}
        snapshot={snapshot({
          status: "error",
          jobs: [],
          skillDemand: [],
          adjacentSkills: [],
          displayedPostingCount: 0,
          displayedSourceCount: 0,
          matchingPostingCount: 0,
          lastVerifiedAt: null,
        })}
      />,
    );

    expect(screen.getByRole("link", { name: "다시 시도" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "데이터 정책 보기" })).toHaveAttribute(
      "href",
      "/data-policy",
    );
    expectNoFabricatedUi();
  });
});
