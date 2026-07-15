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
    [
      "트웰브랩스",
      "https://api.ashbyhq.com/posting-api/job-board/twelve-labs",
      "twelve-labs",
    ],
    [
      "루닛",
      "https://apply.workable.com/lunit/j/50EAF11E27/",
      "lunit",
    ],
    [
      "서울로보틱스",
      "https://job-boards.greenhouse.io/seoulrobotics/jobs/5286550008",
      "seoul-robotics",
    ],
    [
      "휴톰",
      "https://hutom.recruit.roundhr.com/c/mZU9T1qDi2",
      "hutom",
    ],
    [
      "SNJ LAB",
      "https://snjlab.recruit.roundhr.com/c/UUmDpy9KdE",
      "snj-lab",
    ],
    [
      "인딥에이아이",
      "https://indeepai.recruit.roundhr.com/c/8bQzRdU4FR",
      "indeep-ai",
    ],
    [
      "기어세컨드",
      "https://gear2.recruit.roundhr.com/c/Vvx2XVYMfq",
      "gear2",
    ],
    [
      "VESSL AI",
      "https://vessl.recruit.roundhr.com/c/YdJRvvtVN2",
      "vessl-ai",
    ],
    [
      "리디",
      "https://ridi.recruit.roundhr.com/c/PeiuJj2agt",
      "ridi",
    ],
    [
      "뱅크샐러드",
      "https://banksalad.career.greetinghr.com/ko/o/160517",
      "banksalad",
    ],
    [
      "빗썸",
      "https://career.bithumbcorp.com/ko/o/226629",
      "bithumb",
    ],
    [
      "버즈빌",
      "https://buzzvil.career.greetinghr.com/ko/o/215186",
      "buzzvil",
    ],
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
    [
      "마이리얼트립",
      "https://myrealtrip.career.greetinghr.com/ko/o/191470",
      "myrealtrip",
    ],
    ["와디즈", "https://job.wadiz.kr/ko/o/203979", "wadiz"],
    [
      "여기어때컴퍼니",
      "https://gccompany.career.greetinghr.com/ko/o/177169",
      "gccompany",
    ],
    [
      "스캐터랩",
      "https://www.scatterlab.co.kr/ko/o/123249",
      "scatterlab",
    ],
    [
      "채널코퍼레이션",
      "https://channel.io/kr/careers/56661820-4c76-4ded-b1cd-7bad478d192d",
      "channel-corporation",
    ],
    ["핀다", "https://finda.career.greetinghr.com/ko/o/204284", "finda"],
    [
      "딥노이드",
      "https://deepnoid.career.greetinghr.com/ko/o/203035",
      "deepnoid",
    ],
    [
      "에너자이",
      "https://enerzai.career.greetinghr.com/ko/o/69418",
      "enerzai",
    ],
    [
      "퓨리오사AI",
      "https://api.ashbyhq.com/posting-api/job-board/furiosa-ai",
      "furiosa-ai",
    ],
    [
      "Fieldguide",
      "https://api.ashbyhq.com/posting-api/job-board/fieldguide",
      "fieldguide",
    ],
    [
      "Gauss Labs",
      "https://api.lever.co/v0/postings/gausslabs?mode=json",
      "gauss-labs",
    ],
    [
      "Palantir Technologies",
      "https://api.lever.co/v0/postings/palantir?mode=json",
      "palantir",
    ],
    [
      "LG전자",
      "https://globalcareers.lge.com/job/1",
      "lg-electronics",
    ],
    [
      "LINE Plus",
      "https://careers.linecorp.com/jobs/1",
      "line-plus",
    ],
    [
      "CJ올리브네트웍스",
      "https://recruit.cj.net/recruit/job/1",
      "cj-olivenetworks",
    ],
    [
      "카카오페이",
      "https://kakaopay.career.greetinghr.com/ko/o/1",
      "kakao-pay",
    ],
    [
      "카카오모빌리티",
      "https://kakaomobility.career.greetinghr.com/ko/o/1",
      "kakao-mobility",
    ],
    [
      "넷마블",
      "https://career.netmarble.com/announce/view?anno_id=1830",
      "netmarble",
    ],
    [
      "엔씨소프트",
      "https://careers.ncsoft.com/apply/view/101003?companyId=NCH",
      "ncsoft",
    ],
    [
      "컴투스",
      "https://com2us.recruiter.co.kr/career/jobs/108380",
      "com2us",
    ],
    [
      "스마일게이트",
      "https://careers.smilegate.com/apply/announce/view?seq=1",
      "smilegate",
    ],
    [
      "쿠팡",
      "https://job-boards.greenhouse.io/coupang/jobs/1",
      "coupang",
    ],
    [
      "현대자동차",
      "https://talent.hyundai.com/apply/1",
      "hyundai-motor",
    ],
    ["기아", "https://career.kia.com/apply/applyView.kc?id=1", "kia"],
    [
      "SK텔레콤",
      "https://www.skcareers.com/Recruit/Detail/1",
      "sk-telecom",
    ],
    [
      "삼성SDS",
      "https://www.samsungcareers.com/hr/?no=1",
      "samsung-sds",
    ],
    ["EXEM", "https://ex-em.career.greetinghr.com/ko/o/1", "exem"],
    [
      "카카오게임즈",
      "https://recruit.kakaogames.com/ko/o/1",
      "kakao-games",
    ],
    [
      "우아한형제들",
      "https://career.woowahan.com/w1/recruits/1",
      "woowahan-brothers",
    ],
    [
      "삼성전자",
      "https://www.samsungcareers.com/hr/?no=1",
      "samsung-electronics",
    ],
    ["LG CNS", "https://api.careers.lg.com/jobs/1", "lg-cns"],
    [
      "SK하이닉스",
      "https://talent.skhynix.com/hub/ko/apply/job/1",
      "sk-hynix",
    ],
    ["KT", "https://recruit.kt.com/jobs/1", "kt"],
    [
      "포스코DX",
      "https://recruit.posco.com/h22a01-recruit/jobs/1",
      "posco-dx",
    ],
    ["넥슨", "https://careers.nexon.com/job/1", "nexon"],
    [
      "펄어비스",
      "https://www.pearlabyss.com/ko-KR/Company/Careers/1",
      "pearl-abyss",
    ],
    [
      "네오위즈",
      "https://api.lever.co/v0/postings/neowiz?mode=json",
      "neowiz",
    ],
    [
      "NHN KCP",
      "https://kcp.career.greetinghr.com/ko/o/1",
      "nhn-kcp",
    ],
    [
      "뉴빌리티",
      "https://neubility.career.greetinghr.com/ko/o/1",
      "neubility",
    ],
    [
      "비트센싱",
      "https://bitsensing.career.greetinghr.com/ko/o/1",
      "bitsensing",
    ],
    [
      "현대오토에버",
      "https://hyundai-autoever.career.greetinghr.com/ko/o/1",
      "hyundai-autoever",
    ],
  ])("uses the verified cached logo endpoint for %s", (name, source, key) => {
    expect(companyIdentity(name, source)).toMatchObject({
      kind: "logo",
      src: `/company-logo-assets/${key}`,
      alt: `${name} 로고`,
    });
  });

  it("uses Ably's official local mark for its career and application hosts", () => {
    expect(
      companyIdentity(
        "에이블리코퍼레이션",
        "https://tydtr0dj.ninehire.site/job_posting/1Ni2VkMj",
      ),
    ).toMatchObject({
      kind: "logo",
      src: "/company-logos/ably.svg",
      alt: "에이블리코퍼레이션 로고",
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
