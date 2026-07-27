import { describe, expect, it } from "vitest";

import {
  normalizePostingDetail,
  normalizePostingSummary,
} from "./posting-contract";

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

describe("posting detail image contract", () => {
  const detail = {
    ...posting,
    description_html: '<img src="/detail.png">',
    description_text: "상시 채용입니다.",
    skills: [],
  };

  it("preserves validated description images", () => {
    expect(
      normalizePostingDetail({
        ...detail,
        description_images: [
          {
            url: "https://ligdna.recruiter.co.kr/upload/full.png",
            alt: "채용 공고 상세 내용 이미지 1",
          },
        ],
      }).description_images,
    ).toEqual([
      {
        url: "https://ligdna.recruiter.co.kr/upload/full.png",
        alt: "채용 공고 상세 내용 이미지 1",
      },
    ]);
  });

  it("defaults an older response without description images to an empty list", () => {
    expect(normalizePostingDetail(detail).description_images).toEqual([]);
  });

  it.each([
    null,
    {},
    [{ url: "javascript:alert(1)", alt: "공고 이미지" }],
    [{ url: "https://example.com/detail.png", alt: 42 }],
  ])("rejects an invalid description image payload: %o", (description_images) => {
    expect(() =>
      normalizePostingDetail({ ...detail, description_images }),
    ).toThrow();
  });
});
