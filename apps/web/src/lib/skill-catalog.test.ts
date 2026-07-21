import { describe, expect, it } from "vitest";

import {
  canonicalSkillName,
  parseSkillCatalogResponse,
} from "./skill-catalog";

const catalog = [
  {
    name: "React Native",
    category: "mobile",
    kind: "framework",
    domains: ["mobile", "frontend"],
  },
];

describe("skill catalog contract", () => {
  it("validates the response and canonicalizes exact user input", () => {
    expect(parseSkillCatalogResponse({ items: catalog, total: 1 })).toEqual({
      items: catalog,
      total: 1,
    });
    expect(canonicalSkillName(" react native ", catalog)).toBe("React Native");
    expect(canonicalSkillName("Custom Tool", catalog)).toBe("Custom Tool");
  });

  it("rejects inconsistent totals and duplicate canonical names", () => {
    expect(() =>
      parseSkillCatalogResponse({ items: catalog, total: 2 }),
    ).toThrow("invalid skill catalog response");
    expect(() =>
      parseSkillCatalogResponse({ items: [...catalog, ...catalog], total: 2 }),
    ).toThrow("invalid skill catalog response");
  });
});
