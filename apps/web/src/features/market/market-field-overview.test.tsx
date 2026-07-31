import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { MarketField } from "./model";
import { MarketFieldOverview } from "./market-field-overview";

const fields: MarketField[] = [
  {
    domain: "cloud",
    label: "클라우드·플랫폼",
    postingCount: 12,
    companyCount: 7,
    careerCounts: { newComer: 2, experienced: 8, mixedOrUnknown: 2 },
    topLocations: ["서울", "판교"],
    topSkills: ["Kubernetes", "Docker"],
    jobs: [
      {
        id: "job-cloud",
        companyName: "새회사",
        title: "플랫폼 엔지니어",
        careerLabel: "경력",
        employmentLabel: "정규직",
        location: "서울",
        verifiedAt: "2026-07-29T00:00:00Z",
        sourceUrl: "https://example.com/jobs/cloud",
        skills: ["Kubernetes", "Docker"],
        href: "/jobs/job-cloud",
      },
    ],
  },
  {
    domain: "backend",
    label: "백엔드 개발",
    postingCount: 8,
    companyCount: 5,
    careerCounts: { newComer: 1, experienced: 6, mixedOrUnknown: 1 },
    topLocations: ["서울"],
    topSkills: ["Java", "Spring"],
    jobs: [],
  },
];

afterEach(cleanup);

describe("MarketFieldOverview", () => {
  it("shows posting and distinct-company evidence for a selected career field", () => {
    render(
      <MarketFieldOverview
        fields={fields}
        initialField="cloud"
        scope={{ evidencePostingCount: 20, analyzedPostingCount: 24, analyzedCompanyCount: 8, graphSkillCount: 14, graphLimit: 100 }}
      />,
    );

    const region = screen.getByRole("region", { name: "분야별 채용 현황" });
    expect(within(region).getByRole("heading", { name: "클라우드·플랫폼" })).toBeInTheDocument();
    expect(within(region).getByText("공고 수").parentElement).toHaveTextContent("12건");
    expect(within(region).getByText("기업 수").parentElement).toHaveTextContent("7곳");
    expect(within(region).getByText("경력").parentElement).toHaveTextContent("8건");
    expect(within(region).getByRole("link", { name: /플랫폼 엔지니어/ })).toHaveAttribute(
      "href",
      "/jobs/job-cloud",
    );
    expect(region).toHaveTextContent("전체 채용시장을 대표하지 않습니다");
  });

  it("lets users switch and compare fields without inventing a fit score", () => {
    render(
      <MarketFieldOverview
        fields={fields}
        initialField="cloud"
        scope={{ evidencePostingCount: 20, analyzedPostingCount: 24, analyzedCompanyCount: 8, graphSkillCount: 14, graphLimit: 100 }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "백엔드 개발 분야 보기" }));
    expect(screen.getByRole("heading", { name: "백엔드 개발" })).toBeInTheDocument();
    expect(screen.getByText("공고 수").parentElement).toHaveTextContent("8건");

    fireEvent.change(screen.getByLabelText("비교할 분야"), {
      target: { value: "cloud" },
    });
    const comparison = screen.getByRole("region", { name: "커리어 분야 비교" });
    expect(
      within(comparison).getByRole("heading", { name: "백엔드 개발", level: 4 }),
    ).toBeInTheDocument();
    expect(
      within(comparison).getByRole("heading", { name: "클라우드·플랫폼", level: 4 }),
    ).toBeInTheDocument();
    expect(comparison).not.toHaveTextContent("적합도");
  });
});
