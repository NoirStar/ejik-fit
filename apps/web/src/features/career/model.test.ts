import { describe, expect, it } from "vitest";

import type { FitAnalyzeResponse } from "@/lib/types";

import {
  buildCareerAnalyzePayload,
  buildCareerDomainSuggestions,
  buildCareerJobsHref,
  buildCareerSnapshot,
  CAREER_CONDITIONS,
  careerConditionLabel,
  formatDomainLabel,
} from "./model";

const fit: FitAnalyzeResponse = {
  coverage: {
    matching_posting_count: 17,
    strong_fit_posting_count: 6,
  },
  recommended_next_skills: [
    {
      skill: "Spring Boot & Cloud",
      reason: "backend reason",
      required_count: 8,
      preferred_count: 3,
      supporting_posting_count: 10,
    },
    {
      skill: "Kafka",
      reason: "backend reason",
      required_count: 4,
      preferred_count: 2,
      supporting_posting_count: 6,
    },
  ],
  domain_branches: [
    {
      domain: "robotics",
      covered_skills: ["C++"],
      missing_required_skills: ["ROS", "Linux"],
      missing_preferred_skills: ["SLAM"],
      supporting_posting_count: 5,
    },
    {
      domain: "custom_domain",
      covered_skills: ["Python"],
      missing_required_skills: ["Docker"],
      missing_preferred_skills: [],
      supporting_posting_count: 2,
    },
  ],
};

describe("career overview model", () => {
  it("exposes the supported career conditions with precise labels", () => {
    expect(CAREER_CONDITIONS).toEqual([
      { value: "", label: "전체" },
      { value: "new_comer", label: "신입" },
      { value: "experienced", label: "경력" },
      { value: "mixed", label: "신입·경력" },
    ]);
    expect(careerConditionLabel("mixed")).toBe("신입·경력");
  });

  it("omits career_type for all conditions and includes it otherwise", () => {
    expect(buildCareerAnalyzePayload([" Python ", "Java", "Python"], "")).toEqual({
      owned_skills: ["Java", "Python"],
    });
    expect(
      buildCareerAnalyzePayload(["Python"], "experienced", "robotics"),
    ).toEqual({
      owned_skills: ["Python"],
      career_type: "experienced",
      domains: ["robotics"],
    });
  });

  it("builds honest domain choices from graph node metadata", () => {
    expect(
      buildCareerDomainSuggestions({
        nodes: [
          { domains: ["backend", "cloud", "backend"] },
          { domains: ["backend", "robotics"] },
          { domains: ["cloud", ""] },
        ],
      }),
    ).toEqual([
      { value: "backend", label: "백엔드", skillCount: 2 },
      { value: "cloud", label: "클라우드", skillCount: 2 },
      { value: "robotics", label: "로보틱스", skillCount: 1 },
    ]);
    expect(() => buildCareerDomainSuggestions({ nodes: null })).toThrow(
      "invalid domain suggestion response",
    );
  });

  it("maps fit counts and evidence without inventing a percentage", () => {
    const snapshot = buildCareerSnapshot(fit, "experienced", "robotics");

    expect(snapshot.metrics).toEqual({
      matchingPostingCount: 17,
      strongFitPostingCount: 6,
      recommendationCount: 2,
    });
    expect(snapshot).not.toHaveProperty("fitPercent");
    expect(snapshot.scopeLabel).toBe("로보틱스 · 경력");
    expect(snapshot.recommendations[0]).toMatchObject({
      name: "Spring Boot & Cloud",
      requiredCount: 8,
      preferredCount: 3,
      supportingPostingCount: 10,
      skillHref: "/skill-map?skill=Spring%20Boot%20%26%20Cloud",
      jobsHref:
        "/jobs?q=Spring+Boot+%26+Cloud&career_type=experienced",
    });
  });

  it("maps domain labels and keeps covered and missing skills separate", () => {
    const snapshot = buildCareerSnapshot(fit, "");

    expect(snapshot.branches[0]).toEqual({
      domain: "robotics",
      label: "로보틱스",
      coveredSkills: ["C++"],
      missingRequiredSkills: ["ROS", "Linux"],
      missingPreferredSkills: ["SLAM"],
      supportingPostingCount: 5,
    });
    expect(snapshot.branches[1].label).toBe("custom_domain");
    expect(formatDomainLabel("backend")).toBe("백엔드");
  });

  it("builds encoded job links with an optional career condition", () => {
    expect(buildCareerJobsHref("C++ & Linux", "new_comer")).toBe(
      "/jobs?q=C%2B%2B+%26+Linux&career_type=new_comer",
    );
    expect(buildCareerJobsHref("Go", "")).toBe("/jobs?q=Go");
  });

  it("converts an empty response into zero metrics and empty lists", () => {
    const snapshot = buildCareerSnapshot(
      {
        coverage: {
          matching_posting_count: 0,
          strong_fit_posting_count: 0,
        },
        recommended_next_skills: [],
        domain_branches: [],
      },
      "",
    );

    expect(snapshot.metrics).toEqual({
      matchingPostingCount: 0,
      strongFitPostingCount: 0,
      recommendationCount: 0,
    });
    expect(snapshot.recommendations).toEqual([]);
    expect(snapshot.branches).toEqual([]);
  });
});
