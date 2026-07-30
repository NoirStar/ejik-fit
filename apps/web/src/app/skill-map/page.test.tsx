import { describe, expect, it, vi } from "vitest";

import { permanentRedirect } from "next/navigation";

import LegacySkillMapPage from "./page";

vi.mock("next/navigation", () => ({
  permanentRedirect: vi.fn(),
}));

describe("legacy skill-map route", () => {
  it("permanently redirects to career-map and preserves shared query values", async () => {
    await LegacySkillMapPage({
      searchParams: Promise.resolve({
        owned_skills: ["Java", "Kafka"],
        career_type: "experienced",
      }),
    });

    expect(permanentRedirect).toHaveBeenCalledWith(
      "/career-map?owned_skills=Java&owned_skills=Kafka&career_type=experienced",
    );
  });
});
