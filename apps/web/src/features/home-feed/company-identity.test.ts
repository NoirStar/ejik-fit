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
      "AB180",
      "https://recruit.ab180.co/job_posting/yTlPR6Ki",
      "ab180",
    ],
    [
      "42dot",
      "https://api.ashbyhq.com/posting-api/job-board/42dot",
      "42dot",
    ],
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
      "콕스웨이브",
      "https://coxwave.recruit.roundhr.com/c/u2CKaMyTaP",
      "coxwave",
    ],
    [
      "레브잇",
      "https://team.alwayz.co/job_posting/h1igwBcp",
      "levit",
    ],
    [
      "슈프리마",
      "https://hr-suprema.career.greetinghr.com/ko/o/196994",
      "suprema",
    ],
    [
      "KB데이타시스템",
      "https://kbds.career.greetinghr.com/ko/o/222222",
      "kbds",
    ],
    [
      "딥엑스",
      "https://deepx.career.greetinghr.com/ko/o/160535",
      "deepx",
    ],
    [
      "숨고",
      "https://soomgo.career.greetinghr.com/o/204087",
      "soomgo",
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
    ["미리디", "https://www.miridih.com/ko/o/69762", "miridih"],
    [
      "왓챠",
      "https://watchateam.career.greetinghr.com/ko/o/214341",
      "watcha",
    ],
    [
      "이스트소프트 그룹",
      "https://estfamily.career.greetinghr.com/ko/o/220483",
      "estfamily",
    ],
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
    ["하이브", "https://careers.hybecorp.com/ko/o/177425", "hybe"],
    [
      "스푼랩스",
      "https://career.spoonlabs.com/ko/o/220250",
      "spoonlabs",
    ],
    ["두잇", "https://career.doeat.io/ko/o/97177", "doeat"],
    [
      "알세미",
      "https://alsemy.career.greetinghr.com/ko/o/213440",
      "alsemy",
    ],
    [
      "피에프씨테크놀로지스",
      "https://pfct.career.greetinghr.com/ko/o/221489",
      "pfct",
    ],
    [
      "리멤버앤컴퍼니",
      "https://hello.remember.co.kr/job_posting/8n1nIySe",
      "remember",
    ],
    [
      "셀렉트스타",
      "https://selectstar.ninehire.site/job_posting/y0utyOpo",
      "selectstar",
    ],
    [
      "KREAM",
      "https://recruit.kreamcorp.com/rcrt/view.do?annoId=30005165",
      "kream",
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
      "Databricks",
      "https://boards-api.greenhouse.io/v1/boards/databricks/jobs?content=true",
      "databricks",
    ],
    [
      "Airwallex",
      "https://jobs.ashbyhq.com/airwallex/00000000-0000-0000-0000-000000000000",
      "airwallex",
    ],
    [
      "Applied Intuition",
      "https://jobs.ashbyhq.com/applied/00000000-0000-0000-0000-000000000000",
      "applied-intuition",
    ],
    [
      "Reflection AI",
      "https://jobs.ashbyhq.com/reflectionai/00000000-0000-0000-0000-000000000000",
      "reflection-ai",
    ],
    [
      "Cheiron",
      "https://jobs.ashbyhq.com/cheiron/00000000-0000-0000-0000-000000000000",
      "cheiron",
    ],
    [
      "Cohere",
      "https://jobs.ashbyhq.com/cohere/00000000-0000-0000-0000-000000000000",
      "cohere",
    ],
    [
      "Datadog",
      "https://job-boards.greenhouse.io/datadog/jobs/0000000000",
      "datadog",
    ],
    [
      "UJET",
      "https://job-boards.greenhouse.io/ujet/jobs/0000000000",
      "ujet",
    ],
    [
      "OVERDARE",
      "https://job-boards.greenhouse.io/overdare/jobs/0000000000",
      "overdare",
    ],
    [
      "Cognite",
      "https://job-boards.greenhouse.io/cognite/jobs/0000000000",
      "cognite",
    ],
    [
      "CLO Virtual Fashion",
      "https://jobs.lever.co/clovirtualfashion/00000000-0000-0000-0000-000000000000",
      "clo-virtual-fashion",
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
      "kakao-mobility-mark",
    ],
    [
      "슈퍼센트",
      "https://supercent.career.greetinghr.com/ko/o/213168",
      "supercent",
    ],
    [
      "넥스트증권",
      "https://nextsecurities.career.greetinghr.com/ko/o/172330",
      "next-securities",
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
    [
      "현대모비스",
      "https://careers.mobis.com/jobs-view?seq=3904",
      "hyundai-mobis",
    ],
    ["기아", "https://career.kia.com/apply/applyView.kc?id=1", "kia"],
    [
      "SK텔레콤",
      "https://www.skcareers.com/Recruit/Detail/1",
      "sk-telecom",
    ],
    [
      "티맵모빌리티",
      "https://www.skcareers.com/Recruit/Detail/2",
      "tmap-mobility",
    ],
    [
      "SK실트론",
      "https://www.skcareers.com/Recruit/Detail/3",
      "sk-siltron",
    ],
    [
      "SK시그넷",
      "https://www.skcareers.com/Recruit/Detail/4",
      "sk-signet",
    ],
    [
      "SK인텔릭스",
      "https://www.skcareers.com/Recruit/Detail/R261530",
      "sk-intellix",
    ],
    [
      "SK키파운드리",
      "https://www.skcareers.com/Recruit/Detail/R261542",
      "sk-keyfoundry",
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
      "LG AI연구원",
      "https://www.lgresearch.ai/careers/view?seq=316",
      "lg-ai-research",
    ],
    [
      "LG유플러스",
      "https://careers.lg.com/apply/detail?id=1001958",
      "lg-uplus",
    ],
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
      "NHN 그룹",
      "https://careers.nhn.com/recruits/4370711607830110861",
      "nhn-group",
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
    [
      "크래프톤",
      "https://boards-api.greenhouse.io/v1/boards/krafton/jobs?content=true",
      "krafton-mark",
    ],
    [
      "한화시스템",
      "https://hwadm.hanwhain.com/new-backend/portal/api/rcRecruit/search-rcrt",
      "hanwha-systems",
    ],
    [
      "DeepAuto.ai",
      "https://deepauto-ai.career.greetinghr.com/ko",
      "deepauto-ai",
    ],
    [
      "로앤컴퍼니",
      "https://lawcompany.career.greetinghr.com/ko",
      "lawcompany",
    ],
    ["시프트업", "https://shiftup.co.kr/recruit/recruit.php", "shiftup"],
    [
      "데브시스터즈",
      "https://careers.devsisters.com/ko/home",
      "devsisters",
    ],
    ["위메이드", "https://recruit.wemade.com/", "wemade"],
    [
      "Amazon Web Services Korea",
      "https://www.amazon.jobs/en/search.json?country=KOR",
      "amazon-web-services-korea",
    ],
    [
      "NVIDIA Korea",
      "https://nvidia.wd5.myworkdayjobs.com/wday/cxs/nvidia/NVIDIAExternalCareerSite/jobs",
      "nvidia-korea",
    ],
    [
      "Riot Games Korea",
      "https://boards-api.greenhouse.io/v1/boards/riotgames/jobs?content=true",
      "riot-games-korea",
    ],
    [
      "Wiz Korea",
      "https://boards-api.greenhouse.io/v1/boards/wizinc/jobs?content=true",
      "wiz-korea",
    ],
    [
      "Celonis Korea",
      "https://boards-api.greenhouse.io/v1/boards/celonis/jobs?content=true",
      "celonis-korea",
    ],
    [
      "OpenAI Korea",
      "https://api.ashbyhq.com/posting-api/job-board/openai",
      "openai-korea",
    ],
    [
      "백패커",
      "https://idus.career.greetinghr.com/ko/o/227262",
      "backpackr",
    ],
    [
      "Apple Korea",
      "https://jobs.apple.com/en-us/details/200670285-3631/example",
      "apple-korea",
    ],
    [
      "Microsoft Korea",
      "https://apply.careers.microsoft.com/careers/job/1970393556871047",
      "microsoft-korea",
    ],
    [
      "Qualcomm Korea",
      "https://careers.qualcomm.com/careers/job/446719415948",
      "qualcomm-korea",
    ],
    [
      "AMD Korea",
      "https://careers.amd.com/careers-home/jobs/87669?lang=en-us",
      "amd-korea",
    ],
    [
      "SAP Korea",
      "https://jobs.sap.com/job/Seoul-HANA-Cloud-Developer/1270982501/",
      "sap-korea-mark",
    ],
    [
      "Google Korea",
      "https://www.google.com/about/careers/applications/jobs/results/100776713255822022-example",
      "google-korea",
    ],
    [
      "FriendliAI",
      "https://api.ashbyhq.com/posting-api/job-board/friendliai",
      "friendli-ai",
    ],
    [
      "Hopae",
      "https://api.ashbyhq.com/posting-api/job-board/hopae",
      "hopae",
    ],
    [
      "디노티시아",
      "https://dno.career.greetinghr.com/ko/o/198903",
      "dnotitia",
    ],
    [
      "모빌린트",
      "https://mobilinthire.career.greetinghr.com/ko/o/196632",
      "mobilint",
    ],
    [
      "스트라드비젼",
      "https://stradvision.career.greetinghr.com/ko/o/200520",
      "stradvision",
    ],
    [
      "RLWRLD",
      "https://realworld.career.greetinghr.com/ko/o/195922",
      "rlwrld",
    ],
    [
      "크라우드웍스",
      "https://crowdworks.career.greetinghr.com/ko/o/1",
      "crowdworks",
    ],
    ["데이블", "https://dable.career.greetinghr.com/ko/o/1", "dable"],
    ["모레(Moreh)", "https://moreh.career.greetinghr.com/ko/o/1", "moreh"],
    [
      "하이퍼엑셀",
      "https://hyperaccel.career.greetinghr.com/ko/o/1",
      "hyperaccel",
    ],
    [
      "피처링",
      "https://featuring.career.greetinghr.com/ko/o/1",
      "featuring",
    ],
    [
      "올거나이즈",
      "https://allganize.career.greetinghr.com/ko/o/1",
      "allganize",
    ],
    [
      "마크비전",
      "https://boards-api.greenhouse.io/v1/boards/marqvision/jobs/1",
      "marqvision",
    ],
    [
      "네이버웹툰",
      "https://recruit.webtoonscorp.com/rcrt/view.do?annoId=1",
      "naver-webtoon",
    ],
    [
      "네이버클라우드",
      "https://recruit.navercorp.com/rcrt/view.do?annoId=1",
      "naver-cloud",
    ],
    [
      "네이버랩스",
      "https://recruit.navercorp.com/rcrt/view.do?annoId=2",
      "naver-labs",
    ],
    [
      "SNOW",
      "https://recruit.navercorp.com/rcrt/view.do?annoId=3",
      "snow",
    ],
    [
      "팀블라인드",
      "https://recruit.teamblind.com/job_posting/QmXf5Tqm",
      "teamblind",
    ],
    [
      "크몽",
      "https://kmong.career.greetinghr.com/ko/o/1",
      "kmong",
    ],
    [
      "직방",
      "https://zigbang.career.greetinghr.com/ko/o/1",
      "zigbang",
    ],
    [
      "야놀자",
      "https://yanolja.wd102.myworkdayjobs.com/External_Yanolja/job/1",
      "yanolja",
    ],
    [
      "카카오엔터프라이즈",
      "https://careers.kakaoenterprise.com/ko/o/1",
      "kakao-enterprise",
    ],
    [
      "카카오스타일",
      "https://career.kakaostyle.com/job_posting/1",
      "kakao-style",
    ],
    [
      "카카오헬스케어",
      "https://recruit.kakaohealthcare.com/job_posting/1",
      "kakao-healthcare",
    ],
    [
      "메가존클라우드 그룹",
      "https://career.megazone.com/job_posting/1",
      "megazone-cloud",
    ],
    [
      "11번가",
      "https://11st.career.greetinghr.com/ko/o/1",
      "11st",
    ],
    [
      "CLASS101",
      "https://jobs.class101.net/job_posting/DL5fCbnJ",
      "class101",
    ],
    [
      "콴다(QANDA)",
      "https://recruit.mathpresso.com/ko/o/1",
      "qanda",
    ],
    [
      "뱅크샐러드",
      "https://www.banksalad.com/proxy/api/greeting/openings",
      "banksalad",
    ],
    [
      "서울로보틱스",
      "https://boards-api.greenhouse.io/v1/boards/seoulrobotics/jobs?content=true",
      "seoul-robotics",
    ],
    [
      "SK하이닉스",
      "https://www.skcareers.com/Recruit/GetRecruitList#sk-hynix",
      "sk-hynix",
    ],
    [
      "팀스파르타",
      "https://career.spartaclub.kr/ko/o/224860",
      "teamsparta",
    ],
    [
      "페이히어",
      "https://careers.payhere.in/job_posting/example",
      "payhere",
    ],
    [
      "소크라AI",
      "https://socraai.career.greetinghr.com/ko/o/135403",
      "socra-ai",
    ],
    [
      "Normal Computing",
      "https://jobs.ashbyhq.com/normalcomputing/example",
      "normal-computing",
    ],
  ])("uses the verified cached logo endpoint for %s", (name, source, key) => {
    expect(companyIdentity(name, source)).toMatchObject({
      kind: "logo",
      src: `/company-logo-assets/${key}`,
      alt: `${name} 로고`,
    });
  });

  it.each([
    [
      "크래프톤",
      "https://boards-api.greenhouse.io/v1/boards/krafton/jobs?content=true",
      "krafton-mark",
    ],
    [
      "카카오모빌리티",
      "https://kakaomobility.career.greetinghr.com/ko/o/1",
      "kakao-mobility-mark",
    ],
    [
      "슈퍼센트",
      "https://supercent.career.greetinghr.com/ko/o/213168",
      "supercent",
    ],
    [
      "넥스트증권",
      "https://nextsecurities.career.greetinghr.com/ko/o/172330",
      "next-securities",
    ],
  ])("uses the dark icon surface for %s", (name, source, key) => {
    expect(companyIdentity(name, source)).toMatchObject({
      kind: "logo",
      src: `/company-logo-assets/${key}`,
      surface: "dark",
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

  it("uses Kbank's official careers mark for its trusted hosts", () => {
    expect(
      companyIdentity(
        "케이뱅크",
        "https://kbank.recruiter.co.kr/app/jobnotice/view?jobnoticeSn=259460",
      ),
    ).toMatchObject({
      kind: "logo",
      src: "/company-logo-assets/kbank",
      alt: "케이뱅크 로고",
    });
  });

  it("uses Lablup's official mark for its careers host", () => {
    expect(
      companyIdentity(
        "래블업",
        "https://www.lablup.com/ko/careers/senior-CORE-software-engineer",
      ),
    ).toMatchObject({
      kind: "logo",
      src: "/company-logo-assets/lablup",
      alt: "래블업 로고",
    });
  });

  it("uses Liner's official mark for its careers host", () => {
    expect(
      companyIdentity(
        "라이너",
        "https://liner.com/careers/jobs/187408",
      ),
    ).toMatchObject({
      kind: "logo",
      src: "/company-logo-assets/liner",
      alt: "라이너 로고",
      surface: "dark",
    });
  });

  it("uses Elice's official mark for its careers host", () => {
    expect(
      companyIdentity(
        "엘리스그룹",
        "https://www.elice.careers/jobs?recordId=recwTAG9wHYNLGVdn",
      ),
    ).toMatchObject({
      kind: "logo",
      src: "/company-logo-assets/elice",
      alt: "엘리스그룹 로고",
    });
  });

  it("uses compact initials when no verified asset exists", () => {
    expect(
      companyIdentity("Example Robotics", "https://example.com/careers"),
    ).toEqual({
      kind: "initials",
      initials: "ER",
      alt: "Example Robotics",
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
