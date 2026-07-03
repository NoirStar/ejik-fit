import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkillRanking } from "./skill-ranking";


const stats = [
  { skill: "Python", category: "language", count: 40 },
  { skill: "AWS", category: "infra", count: 20 },
];


describe("SkillRanking", () => {
  it("renders skills with localized category and demand count", () => {
    render(<SkillRanking stats={stats} />);

    expect(screen.getByText("Python")).toBeInTheDocument();
    expect(screen.getByText("언어")).toBeInTheDocument();
    expect(screen.getByText("40건")).toBeInTheDocument();
    expect(screen.getByText("인프라")).toBeInTheDocument();
  });

  it("renders nothing when there are no stats", () => {
    const { container } = render(<SkillRanking stats={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
