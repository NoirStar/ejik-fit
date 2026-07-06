import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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


describe("SkillRanking", () => {
  it("renders skills with localized category and demand count", () => {
    render(<SkillRanking stats={stats} />);

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("언어")).toBeInTheDocument();
    expect(screen.getByText("40건")).toBeInTheDocument();
    expect(screen.getByText("필수 24 · 우대 10")).toBeInTheDocument();
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

    expect(screen.getByText("필수 0 · 우대 0")).toBeInTheDocument();
  });
});
