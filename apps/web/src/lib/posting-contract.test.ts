import { describe, expect, it } from "vitest";

import { normalizePostingSummary } from "./posting-contract";

const posting = {
  id: "job-1",
  title: "백엔드 엔지니어",
  company_name: "테스트 기업",
  career_type: "experienced",
  employment_type: "full_time",
  career_min: 3,
  career_max: 7,
  location: "서울",
  status: "open",
  source_url: "https://careers.example.com/job-1",
  last_verified_at: "2026-07-14T00:00:00Z",
  opens_at: null,
  closes_at: null,
  required_skills: ["Go"],
  preferred_skills: [],
  unspecified_skills: [],
};

describe("posting contract company slug", () => {
  it("preserves a valid backend company slug", () => {
    expect(
      normalizePostingSummary({ ...posting, company_slug: "verified-company" })
        .company_slug,
    ).toBe("verified-company");
  });

  it("remains compatible while an older backend omits the slug", () => {
    expect(normalizePostingSummary(posting).company_slug).toBeUndefined();
  });

  it.each(["", "Verified Company", "../company", 42, null])(
    "does not expose an unsafe company route value: %s",
    (company_slug) => {
      expect(
        normalizePostingSummary({ ...posting, company_slug }).company_slug,
      ).toBeUndefined();
    },
  );
});
