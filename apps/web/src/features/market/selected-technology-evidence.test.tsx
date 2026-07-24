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
          companyCount: 8,
          postingCount: 12,
          explicitCount: 9,
          requiredCount: 5,
          preferredCount: 4,
          unspecifiedCount: 3,
          relativeCompanyBreadth: 100,
          relativeExplicitDemand: 100,
          skillHref: "/skill-map?skill=Kubernetes",
          jobsHref: "/jobs?q=Kubernetes",
        }}
      />,
    );

    expect(screen.getByText("명시 요구").closest("div")).toHaveTextContent(
      "명시 요구9건",
    );
    expect(screen.getByText("필수·우대 미표기").closest("div")).toHaveTextContent(
      "필수·우대 미표기3건",
    );
    expect(
      screen.getByText(/최대 100개 공고를 기준/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/구분 안 됨/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "관련 공고 전체 보기" }),
    ).toHaveAttribute("href", "/jobs?q=Kubernetes");
    expect(
      screen.getByRole("link", { name: "내 스킬맵에서 보기" }),
    ).toHaveAttribute("href", "/skill-map?skill=Kubernetes");
  });
});
