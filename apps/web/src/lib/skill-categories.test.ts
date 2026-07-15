import { describe, expect, it } from "vitest";

import {
  SKILL_CATEGORIES,
  normalizeSkillCategory,
  skillCategoryLabel,
} from "./skill-categories";

describe("skill category filters", () => {
  it("keeps only catalog-backed category query values", () => {
    expect(normalizeSkillCategory("infra")).toBe("infra");
    expect(normalizeSkillCategory(["backend", "ai"])).toBe("backend");
    expect(normalizeSkillCategory("unknown")).toBe("");
    expect(normalizeSkillCategory(undefined)).toBe("");
  });

  it("provides honest Korean labels for every supported category", () => {
    expect(SKILL_CATEGORIES).toHaveLength(14);
    expect(skillCategoryLabel("")).toBe("전체 기술 분야");
    expect(skillCategoryLabel("infra")).toBe("인프라");
    expect(skillCategoryLabel("robotics")).toBe("로보틱스");
  });
});
