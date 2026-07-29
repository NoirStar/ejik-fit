import { describe, expect, it } from "vitest";

import {
  canonicalSkillName,
  parseSkillCatalogResponse,
  resolveSkillInput,
} from "./skill-catalog";

const catalog = [
  {
    name: "React Native",
    category: "mobile",
    kind: "framework",
    domains: ["mobile", "frontend"],
    aliases: ["reactnative"],
  },
];

describe("skill catalog contract", () => {
  it("validates the response and canonicalizes exact user input", () => {
    expect(parseSkillCatalogResponse({ items: catalog, total: 1 })).toEqual({
      items: catalog,
      total: 1,
    });
    expect(canonicalSkillName(" react native ", catalog)).toBe("React Native");
    expect(canonicalSkillName("react   native", catalog)).toBe("React Native");
    expect(canonicalSkillName("Custom Tool", catalog)).toBe("Custom Tool");
    expect(resolveSkillInput("reactnative", catalog)).toBe("React Native");
  });

  it("rejects malformed aliases", () => {
    expect(() =>
      parseSkillCatalogResponse({
        items: [{ ...catalog[0], aliases: ["reactnative", 42] }],
        total: 1,
      }),
    ).toThrow("invalid skill catalog item");
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
