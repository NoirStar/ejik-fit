import { describe, expect, it } from "vitest";

import { companyIdentity } from "./company-identity";

describe("companyIdentity", () => {
  it("returns a verified local logo for Naver aliases", () => {
    expect(
      companyIdentity("네이버", "https://recruit.navercorp.com/jobs/1"),
    ).toEqual({
      kind: "logo",
      src: "/company-logos/naver.svg",
      alt: "네이버 로고",
      initials: "네",
    });

    expect(companyIdentity("NAVER", "https://navercorp.com").src).toBe(
      "/company-logos/naver.svg",
    );
  });

  it("does not store a Kakao logo whose official page forbids commercial use", () => {
    expect(
      companyIdentity("카카오", "https://careers.kakao.com/jobs/1"),
    ).toEqual({
      kind: "initials",
      alt: "카카오",
      initials: "카",
    });
  });

  it("uses compact initials when no verified asset exists", () => {
    expect(
      companyIdentity(
        "DeepAuto.ai",
        "https://deepauto-ai.career.greetinghr.com/ko",
      ),
    ).toEqual({
      kind: "initials",
      initials: "DA",
      alt: "DeepAuto.ai",
    });
    expect(companyIdentity("LINE Plus")).toEqual({
      kind: "initials",
      initials: "LP",
      alt: "LINE Plus",
    });
  });

  it("handles blank names without exposing an empty mark", () => {
    expect(companyIdentity("  ")).toEqual({
      kind: "initials",
      initials: "?",
      alt: "회사",
    });
  });
});
