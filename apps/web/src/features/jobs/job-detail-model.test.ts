import { describe, expect, it } from "vitest";

import type { SkillDetail } from "@/lib/types";

import {
  groupJobSkills,
  matchOwnedJobSkills,
  parsePostingDescription,
} from "./job-detail-model";

const skills: SkillDetail[] = [
  {
    skill: "Go",
    category: "language",
    requirement_type: "required",
    evidence_text: "Go 기반 서버 개발 경험",
    confidence: 0.98,
    match_reason: "distinct_alias",
  },
  {
    skill: "Kubernetes",
    category: "infra",
    requirement_type: "preferred",
    evidence_text: "Kubernetes 운영 경험",
    confidence: 0.96,
    match_reason: "distinct_alias",
  },
  {
    skill: "Jira",
    category: "qa",
    requirement_type: "unspecified",
    evidence_text: null,
    confidence: 1,
    match_reason: "distinct_alias",
  },
];

describe("job detail model", () => {
  it("keeps API requirement groups separate", () => {
    expect(groupJobSkills(skills)).toEqual({
      required: [skills[0]],
      preferred: [skills[1]],
      unspecified: [skills[2]],
    });
  });

  it("matches owned skills exactly without case sensitivity", () => {
    expect(
      matchOwnedJobSkills(skills, ["go", "KUBERNETES", "Java", " Go "]),
    ).toEqual(["Go", "Kubernetes"]);
  });

  it("does not treat a partial skill name as owned", () => {
    expect(matchOwnedJobSkills(skills, ["Go lang", "Kube"])).toEqual([]);
  });

  it("preserves inline headings, bullets, and paragraphs without inventing text", () => {
    const source =
      "회사 소개 문장입니다. 주요업무 ### 이런 업무를 해요 * API를 개발합니다. * 장애를 분석합니다. ### 이런 분이면 더 좋아요 • Go 경험";

    expect(parsePostingDescription(source)).toEqual([
      { kind: "paragraph", text: "회사 소개 문장입니다. 주요업무" },
      { kind: "heading", level: 3, text: "이런 업무를 해요" },
      {
        kind: "list",
        items: ["API를 개발합니다.", "장애를 분석합니다."],
      },
      { kind: "heading", level: 3, text: "이런 분이면 더 좋아요" },
      { kind: "list", items: ["Go 경험"] },
    ]);
  });

  it("keeps explicit line breaks as separate paragraphs", () => {
    expect(parsePostingDescription("첫 문단\r\n\r\n둘째 문단")).toEqual([
      { kind: "paragraph", text: "첫 문단" },
      { kind: "paragraph", text: "둘째 문단" },
    ]);
  });

  it("returns no blocks for an empty description", () => {
    expect(parsePostingDescription("  \n ")).toEqual([]);
  });
});
