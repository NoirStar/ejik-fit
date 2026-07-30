import { describe, expect, it } from "vitest";

import {
  resolveSkillGraphEnabledDomains,
  skillGraphDomainSummary,
  toggleSkillGraphDomain,
} from "./skill-graph-filters";

const domains = ["backend", "frontend", "data"];

describe("skill graph domain filters", () => {
  it("isolates the first selected domain from the all state", () => {
    expect(toggleSkillGraphDomain([], "backend", domains)).toEqual(["backend"]);
  });

  it("adds comparison domains and returns to all after removing the last", () => {
    expect(toggleSkillGraphDomain(["backend"], "data", domains)).toEqual([
      "backend",
      "data",
    ]);
    expect(toggleSkillGraphDomain(["backend"], "backend", domains)).toEqual([]);
  });

  it("drops unknown domains and summarizes the effective selection", () => {
    expect(
      resolveSkillGraphEnabledDomains(["backend", "unknown"], domains),
    ).toEqual(["backend"]);
    expect(resolveSkillGraphEnabledDomains([], domains)).toBeUndefined();
    expect(skillGraphDomainSummary([])).toBe("전체");
    expect(
      skillGraphDomainSummary(["backend"], (domain) =>
        domain === "backend" ? "백엔드" : domain,
      ),
    ).toBe("백엔드");
    expect(skillGraphDomainSummary(["backend", "data"])).toBe("2개");
  });
});
