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

  it.each([
    ["마키나락스", "https://makinarocks.career.greetinghr.com/ko/o/1", "makinarocks"],
    ["리벨리온", "https://rebellions.career.greetinghr.com/ko/o/1", "rebellions"],
    ["코빗", "https://korbit.career.greetinghr.com/ko/o/1", "korbit"],
    ["람다256", "https://lambda256.career.greetinghr.com/ko/o/1", "lambda256"],
    ["업스테이지", "https://careers.upstage.ai/ko/o/1", "upstage"],
    ["노타AI", "https://career.nota.ai/ko/o/1", "nota-ai"],
    ["포트원", "https://portone.career.greetinghr.com/ko/o/1", "portone"],
    ["캐럿AI", "https://carat.career.greetinghr.com/ko/o/1", "carat-ai"],
    ["뤼튼테크놀로지스", "https://wrtn.career.greetinghr.com/ko/o/1", "wrtn"],
    ["당근", "https://careers.daangn.com/jobs/role/1/", "daangn"],
    ["무신사", "https://www.musinsacareers.com/ko/o/1", "musinsa"],
    ["토스 커뮤니티", "https://toss.im/career/job-detail?job_id=1", "toss"],
    ["Moloco", "https://job-boards.greenhouse.io/moloco/jobs/1", "moloco"],
    ["Sendbird", "https://job-boards.greenhouse.io/sendbird/jobs/1", "sendbird"],
    ["쏘카", "https://socar.career.greetinghr.com/ko/o/225577", "socar"],
    ["두나무", "https://careers.dunamu.com/detail/588", "dunamu"],
    ["컬리", "https://kurly.career.greetinghr.com/ko/o/198635", "kurly"],
    [
      "하이퍼커넥트",
      "https://jobs.lever.co/matchgroup/4004a95b-ed89-4193-ad1a-a2ed5d4703d5",
      "hyperconnect",
    ],
    [
      "오늘의집",
      "https://bucketplace.career.greetinghr.com/ko/o/167227",
      "bucketplace",
    ],
  ])("uses the verified cached logo endpoint for %s", (name, source, key) => {
    expect(companyIdentity(name, source)).toMatchObject({
      kind: "logo",
      src: `/company-logo-assets/${key}`,
      alt: `${name} 로고`,
    });
  });

  it("recognizes the Korean Moloco alias", () => {
    expect(
      companyIdentity(
        "몰로코",
        "https://job-boards.greenhouse.io/moloco/jobs/1",
      ),
    ).toMatchObject({
      kind: "logo",
      src: "/company-logo-assets/moloco",
      alt: "Moloco 로고",
    });
  });

  it("uses KakaoBank's official careers logo only for its trusted host", () => {
    expect(
      companyIdentity("카카오뱅크", "https://recruit.kakaobank.com/jobs/257846"),
    ).toMatchObject({
      kind: "logo",
      src: "/company-logos/kakaobank.svg",
      alt: "카카오뱅크 로고",
    });
    expect(
      companyIdentity("카카오뱅크", "https://untrusted.example/jobs/257846"),
    ).toMatchObject({ kind: "initials" });
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
