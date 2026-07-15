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

  it("requires a trusted official source host for a verified logo", () => {
    expect(companyIdentity("NAVER", "https://untrusted.example/jobs/1")).toEqual({
      kind: "initials",
      alt: "NAVER",
      initials: "NA",
    });
  });

  it.each([
    [
      "슈퍼센트",
      "https://supercent.career.greetinghr.com/ko/o/213168",
      "/company-logos/supercent.png",
    ],
    [
      "Sionic AI",
      "https://sionicai.career.greetinghr.com/ko/o/205209",
      "/company-logos/sionic-ai.png",
    ],
    [
      "S2W",
      "https://s2w.career.greetinghr.com/ko/o/199550",
      "/company-logos/s2w.png",
    ],
    [
      "AFI 뒤끝",
      "https://thebackend.career.greetinghr.com/ko/o/141428",
      "/company-logos/afi-backend.jpg",
    ],
    [
      "넥스트증권",
      "https://nextsecurities.career.greetinghr.com/ko/o/172330",
      "/company-logos/next-securities.png",
    ],
    [
      "오누이",
      "https://onuii.career.greetinghr.com/ko/o/190063",
      "/company-logos/onuii.png",
    ],
  ])("returns the verified career-page logo for %s", (name, source, asset) => {
    expect(companyIdentity(name, source)).toMatchObject({
      kind: "logo",
      src: asset,
      alt: `${name} 로고`,
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
