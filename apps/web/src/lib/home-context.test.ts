import { describe, expect, it } from "vitest";

import {
  homeContextFromSearchParams,
  homeContextFromUrlSearchParams,
  homeContextToDashboardHref,
} from "./home-context";

describe("home context URL contract", () => {
  it("normalizes skills and career preferences from server search params", () => {
    expect(
      homeContextFromSearchParams({
        owned_skills: [" Spring ", "Java", "Spring"],
        career_type: "experienced",
        target_domain: "backend",
      }),
    ).toEqual({
      ownedSkills: ["Java", "Spring"],
      careerPreferences: {
        careerCondition: "experienced",
        targetDomain: "backend",
      },
    });
  });

  it("reads the same contract from browser URLSearchParams", () => {
    const params = new URLSearchParams();
    params.append("owned_skills", "React, TypeScript");
    params.append("career_type", "new_comer");
    params.append("target_domain", "frontend");

    expect(homeContextFromUrlSearchParams(params)).toEqual({
      ownedSkills: ["React", "TypeScript"],
      careerPreferences: {
        careerCondition: "new_comer",
        targetDomain: "frontend",
      },
    });
  });

  it("preserves unrelated home actions while replacing managed context", () => {
    expect(
      homeContextToDashboardHref(
        {
          ownedSkills: [" Spring ", "Java", "Spring"],
          careerPreferences: {
            careerCondition: "experienced",
            targetDomain: "backend",
          },
        },
        "compose=1&owned_skills=Old&career_type=mixed&target_domain=cloud",
      ),
    ).toBe(
      "/?compose=1&owned_skills=Java&owned_skills=Spring&career_type=experienced&target_domain=backend#my-stack",
    );
  });

  it("drops invalid career values instead of forwarding them to APIs", () => {
    expect(
      homeContextFromSearchParams({
        owned_skills: "Java",
        career_type: "executive",
        target_domain: "../backend",
      }),
    ).toEqual({
      ownedSkills: ["Java"],
      careerPreferences: {
        careerCondition: "",
        targetDomain: "",
      },
    });
  });
});
