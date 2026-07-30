import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SkillRanking } from "./skill-ranking";


const stats = [
  {
    skill: "Python",
    category: "language",
    count: 40,
    required_count: 24,
    preferred_count: 10,
    unspecified_count: 6,
  },
  {
    skill: "AWS",
    category: "infra",
    count: 20,
    required_count: 8,
    preferred_count: 7,
    unspecified_count: 5,
  },
];

afterEach(cleanup);

describe("SkillRanking", () => {
  it("renders skills with localized category and demand count", () => {
    render(<SkillRanking stats={stats} />);

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("언어")).toBeInTheDocument();
    expect(screen.getByText("40건")).toBeInTheDocument();
    expect(
      screen.getByText("필수 24 · 우대 10 · 구분 없음 6"),
    ).toBeInTheDocument();
    const unspecifiedHelp = screen.getByText(
      "조건 구분 없음: 공고에서 필수 또는 우대로 구분하지 않은 기술",
    );
    expect(unspecifiedHelp).toBeVisible();
    expect(
      screen.getByLabelText("필수 24, 우대 10, 조건 구분 없음 6"),
    ).toHaveAttribute("aria-describedby", unspecifiedHelp.id);
    expect(screen.getByText("인프라")).toBeInTheDocument();
  });

  it("renders nothing when there are no stats", () => {
    const { container } = render(<SkillRanking stats={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("uses zero breakdowns while an older API is still deployed", () => {
    render(
      <SkillRanking
        stats={[{ skill: "Python", category: "language", count: 4 }]}
      />,
    );

    expect(
      screen.getByText("필수 0 · 우대 0 · 구분 없음 0"),
    ).toBeInTheDocument();
  });
});
