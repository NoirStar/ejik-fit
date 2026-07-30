import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SelectedTechnologyEvidence } from "./selected-technology-evidence";

describe("SelectedTechnologyEvidence", () => {
  it("separates full-market counts from the loaded evidence sample", () => {
    render(
      <SelectedTechnologyEvidence
        combinations={[
          {
            id: "Docker::Kubernetes",
            skills: ["Docker", "Kubernetes"],
            postingCount: 2,
          },
        ]}
        error={null}
        jobs={[]}
        selected={{
          id: "infra:kubernetes",
          name: "Kubernetes",
          category: "infra",
          categoryLabel: "인프라",
          postingCount: 12,
          companyCount: 7,
          explicitCount: 9,
          requiredCount: 5,
          preferredCount: 4,
          unspecifiedCount: 3,
          relativeExplicitDemand: 100,
          relativeCompanyBreadth: 100,
          skillHref: "/skills/graph?seed=Kubernetes",
          jobsHref: "/jobs?q=Kubernetes",
        }}
      />,
    );

    expect(screen.getByText("필수·우대 공고").closest("div")).toHaveTextContent(
      "필수·우대 공고9건",
    );
    expect(screen.getByText("조건 구분 없음").closest("div")).toHaveTextContent(
      "조건 구분 없음3건",
    );
    expect(
      screen.getByText(/현재 불러온 최대 100개 채용공고 기준/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "관련 공고 전체 보기" }),
    ).toHaveAttribute("href", "/jobs?q=Kubernetes");
    expect(
      screen.getByRole("link", { name: "기술 관계 보기" }),
    ).toHaveAttribute("href", "/skills/graph?seed=Kubernetes");
  });
});
