import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { MarketSkill } from "./model";
import { TechnologyDemandChart } from "./technology-demand-chart";

function skill(index: number): MarketSkill {
  return {
    id: `language:skill-${index}`,
    name: `Skill ${index}`,
    category: "language",
    categoryLabel: "언어",
    companyCount: 12 - index,
    postingCount: 20 - index,
    explicitCount: 18 - index,
    requiredCount: 10 - Math.floor(index / 2),
    preferredCount: 8 - Math.ceil(index / 2),
    unspecifiedCount: 2,
    relativeCompanyBreadth: Math.round(((12 - index) / 12) * 100),
    relativeExplicitDemand: Math.round(((18 - index) / 18) * 100),
    skillHref: `/skill-map?skill=Skill%20${index}`,
    jobsHref: `/jobs?q=Skill%20${index}`,
  };
}

describe("TechnologyDemandChart", () => {
  it("shows eight explicit-demand rows and expands without navigation", () => {
    const onSelect = vi.fn();
    render(
      <TechnologyDemandChart
        onSelect={onSelect}
        selectedSkill="Skill 0"
        skills={Array.from({ length: 10 }, (_, index) => skill(index))}
        sort="companies"
      />,
    );

    const region = screen.getByRole("region", { name: "시장 기술 확산" });
    expect(region.querySelectorAll("[data-skill-row]")).toHaveLength(8);
    expect(region.querySelector("[data-demand-fill]")).toHaveStyle({
      transform: "scaleX(1)",
    });
    expect(region.querySelector("[data-demand-fill]")).not.toHaveStyle({
      width: "100%",
    });
    expect(within(region).getByText("미표기")).toBeInTheDocument();
    expect(within(region).getAllByText("미표기 2건")).toHaveLength(8);
    expect(within(region).getByText("요구 기업 12곳")).toBeInTheDocument();
    expect(within(region).getByText("공고 20건")).toBeInTheDocument();
    expect(within(region).queryByText(/구분 안 됨/)).not.toBeInTheDocument();
    expect(
      within(region).getByRole("button", { name: "전체 10개 기술 보기" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(region).getByRole("button", { name: "전체 10개 기술 보기" }),
    );
    expect(region.querySelectorAll("[data-skill-row]")).toHaveLength(10);
    expect(
      within(region).getByRole("button", { name: "상위 8개만 보기" }),
    ).toBeInTheDocument();
  });
});
