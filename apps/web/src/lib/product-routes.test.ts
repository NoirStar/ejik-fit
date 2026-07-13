import { describe, expect, it } from "vitest";

import { buildSkillGraphHref } from "./product-routes";

describe("buildSkillGraphHref", () => {
  it("renames the public skill parameter to the graph seed", () => {
    expect(buildSkillGraphHref({ skill: "cpp", field: "systems" })).toBe(
      "/skills/graph?seed=cpp&field=systems",
    );
  });

  it("uses the first skill and preserves repeated owned skills", () => {
    expect(
      buildSkillGraphHref({
        skill: ["cpp", "rust"],
        owned_skills: ["Linux", "Docker"],
      }),
    ).toBe("/skills/graph?seed=cpp&owned_skills=Linux&owned_skills=Docker");
  });

  it("omits empty values without leaving an empty query", () => {
    expect(buildSkillGraphHref({ skill: undefined })).toBe("/skills/graph");
  });
});
