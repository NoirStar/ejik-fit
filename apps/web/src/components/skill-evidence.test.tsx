import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SkillEvidence } from "./skill-evidence";


const skills = [
  {
    skill: "Go",
    category: "language",
    requirement_type: "required" as const,
    evidence_text: "Go 기반 백엔드 개발 경험",
    confidence: 0.95,
    match_reason: "strict_alias_with_context",
  },
  {
    skill: "AWS",
    category: "infra",
    requirement_type: "preferred" as const,
    evidence_text: "AWS 운영 경험자 우대",
    confidence: 1,
    match_reason: "distinct_alias",
  },
  {
    skill: "Docker",
    category: "infra",
    requirement_type: "unspecified" as const,
    evidence_text: "사용 기술: Docker",
    confidence: 1,
    match_reason: "distinct_alias",
  },
];

afterEach(cleanup);


describe("SkillEvidence", () => {
  it("groups skills and renders their source evidence", () => {
    render(<SkillEvidence skills={skills} />);

    expect(screen.getByText("필수 기술")).toBeInTheDocument();
    expect(screen.getByText("우대 기술")).toBeInTheDocument();
    expect(screen.getByText("공고에 언급된 기술")).toBeInTheDocument();
    expect(
      screen.getByText("Go 기반 백엔드 개발 경험"),
    ).toBeInTheDocument();
  });

  it("does not render empty groups", () => {
    render(<SkillEvidence skills={[skills[0]]} />);

    expect(screen.queryByText("우대 기술")).not.toBeInTheDocument();
    expect(
      screen.queryByText("공고에 언급된 기술"),
    ).not.toBeInTheDocument();
  });

  it("does not render a quote when evidence is absent", () => {
    const { container } = render(
      <SkillEvidence
        skills={[{ ...skills[0], evidence_text: null }]}
      />,
    );

    expect(screen.getByText("Go")).toBeInTheDocument();
    expect(container.querySelector("q")).toBeNull();
  });
});
